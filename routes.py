from flask import (
    Blueprint, render_template, request, jsonify, session, current_app, g
)
import os
import tempfile
import hashlib
import time
import json
import traceback
from werkzeug.utils import secure_filename

# Import helper functions
from database import get_db, add_business_record, update_business_ai_data, get_business_by_id, delete_business_record
from utils import allowed_file, extract_text_from_file, chunk_text
from ai_utils import (
    generate_faqs_from_text, extract_business_data_from_text,
    add_document_chunks_to_vector_db, query_vector_db, generate_rag_response
)

# Use Blueprint for routes
bp = Blueprint('main', __name__)

@bp.route('/')
def index():
    """Renders the main index page, checks session for business context."""
    business_id = session.get('current_business_id')
    business_name = None # Fetch name only if needed by template (currently isn't)
    if business_id:
        business = get_business_by_id(business_id) # Uses helper from database.py
        if not business:
            # Clear invalid session ID silently
            session.pop('current_business_id', None)
            current_app.logger.warning(f"Route /: Cleared invalid business_id {business_id} from session.")
        # else:
            # business_name = business['name'] # If template needed it

    # Render template; JS will call /get_business_info to update UI
    return render_template('index.html')

@bp.route('/get_business_info', methods=['GET'])
def get_business_info_route():
    """Endpoint for JS to check initial business status based on session."""
    business_id = session.get('current_business_id')
    if business_id:
        business = get_business_by_id(business_id)
        if business:
             current_app.logger.debug(f"/get_business_info: Found active business {business_id} in session.")
             return jsonify({'business_name': business['name']})
        else:
             session.pop('current_business_id', None)
             current_app.logger.warning(f"Route /get_business_info: Cleared invalid business_id {business_id} from session.")

    current_app.logger.debug("/get_business_info: No active business found in session.")
    return jsonify({'business_name': None})


@bp.route('/upload', methods=['POST'])
def upload_file_route():
    """Handle uploads, process text, store in DB, run sync AI/VDB tasks."""
    # --- Input Validation ---
    if 'file' not in request.files:
        return jsonify({'success': False, 'message': 'No file part in request'}), 400
    file = request.files['file']
    business_name_input = request.form.get('business_name', '').strip()
    if not business_name_input:
         return jsonify({'success': False, 'message': 'Business name is required'}), 400
    if file.filename == '':
        return jsonify({'success': False, 'message': 'No file selected'}), 400
    if not allowed_file(file.filename):
         return jsonify({'success': False, 'message': 'File type not allowed'}), 400
    # ------------------------

    filename = secure_filename(file.filename)
    # Comment: Consider checking if business_name already exists and prompting user to update/overwrite?
    # Current approach always creates a new unique entry.
    business_id = hashlib.md5(f"{business_name_input}-{time.time()}".encode()).hexdigest()[:16]
    temp_dir = tempfile.TemporaryDirectory()
    file_path = os.path.join(temp_dir.name, filename)
    db_record_created = False # Flag to track if DB record was added

    try:
        file.save(file_path)
        current_app.logger.info(f"Route /upload: File saved temporarily to: {file_path}")

        # --- Stage 1: Extract Text ---
        text_content = extract_text_from_file(file_path)
        if not text_content or text_content.startswith("[Error"):
             error_msg = f'Could not extract valid text from {filename}'
             if text_content.startswith("[Error"): error_msg = text_content
             raise ValueError(error_msg)

        # --- Stage 2: Add Business to DB ---
        if not add_business_record(business_id, business_name_input, filename):
             raise Exception("Failed to create initial database record for business.")
        db_record_created = True

        # --- Stage 3: Set Session ---
        session['current_business_id'] = business_id
        current_app.logger.info(f"Route /upload: Set session business_id to: {business_id}")

        # --- Stage 4: AI & Vector DB Processing (Synchronous - SLOW!) ---
        # >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
        # TODO: MOVE THE FOLLOWING BLOCK TO A BACKGROUND TASK (e.g., Celery, RQ)
        # This block performs network I/O (OpenAI embeddings, completions)
        # and potentially CPU-intensive VDB operations. Running it synchronously
        # in the request will block the server and likely lead to timeouts
        # for larger files or slow API responses.
        # <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
        current_app.logger.info(f"Route /upload: Starting SYNC processing for {business_id}...")

        # Chunk Text
        chunks = chunk_text(text_content)
        if not chunks: current_app.logger.warning(f"Warning: No text chunks generated for {filename}")

        # Add Chunks to Vector DB (includes embedding generation)
        vector_db_success = add_document_chunks_to_vector_db(business_id, filename, chunks)
        if not vector_db_success: current_app.logger.warning(f"Warning: Failed adding chunks to VDB for {business_id}")

        # Generate FAQs & Extract Data (OpenAI API Calls)
        generated_faqs = generate_faqs_from_text(text_content)
        extracted_data = extract_business_data_from_text(text_content)

        # Update DB with generated AI data
        update_business_ai_data(
             business_id,
             faqs=generated_faqs,
             products=extracted_data.get('products'),
             business_info=extracted_data.get('business_info')
        )
        # --- End of Synchronous Block ---

        current_app.logger.info(f"Route /upload: SYNC processing complete for {business_id}")
        return jsonify({
            'success': True,
            'business_name': business_name_input,
            'business_id': business_id,
            'message': 'File uploaded and processed successfully. AI is ready.'
        })

    except Exception as e:
        current_app.logger.error(f"Route /upload: Error during processing for {business_name_input}: {str(e)}")
        traceback.print_exc() # Log full traceback for debugging
        if db_record_created: delete_business_record(business_id) # Attempt cleanup
        if session.get('current_business_id') == business_id: session.pop('current_business_id', None)
        return jsonify({'success': False, 'message': f'An internal error occurred during processing.'}), 500
    finally:
         temp_dir.cleanup() # Ensure cleanup happens


@bp.route('/send_message', methods=['POST'])
def send_message_route():
    """Process incoming messages using RAG, getting context from session ID."""
    try:
        data = request.json
        user_message = data.get('message', '').strip()
        if not user_message:
            return jsonify({'response': "Please enter a message."}), 400

        business_id = session.get('current_business_id')
        if not business_id:
            current_app.logger.warning("/send_message: No business_id in session.")
            return jsonify({'response': "Please upload business documents first."}), 400

        business = get_business_by_id(business_id)
        if not business:
            session.pop('current_business_id', None)
            current_app.logger.error(f"/send_message: Invalid business_id '{business_id}' in session.")
            return jsonify({'response': "Your session seems invalid. Please upload documents again."}), 400

        business_name = business['name']
        # Safely load JSON data from DB
        try: faqs = json.loads(business['faqs_json'] or '[]')
        except json.JSONDecodeError: faqs = []
        try: products = json.loads(business['products_json'] or '[]')
        except json.JSONDecodeError: products = []

        # 1. Query Vector DB (Implemented in ai_utils)
        retrieved_chunks = query_vector_db(business_id, user_message, k=3)

        # 2. Generate RAG Response (Implemented in ai_utils)
        ai_response = generate_rag_response(business_name, user_message, retrieved_chunks, faqs, products)

        return jsonify({'response': ai_response})

    except Exception as e:
        current_app.logger.error(f"Route /send_message: Error processing message: {str(e)}")
        traceback.print_exc()
        return jsonify({'response': "Sorry, an unexpected error occurred. Please try again."}), 500


@bp.route('/get_faqs', methods=['GET'])
def get_faqs_route():
    """Return FAQs for the business identified by the session ID."""
    business_id = session.get('current_business_id')
    faqs = []
    if business_id:
        business = get_business_by_id(business_id)
        if business:
            try:
                faqs = json.loads(business['faqs_json'] or '[]')
                current_app.logger.debug(f"/get_faqs: Found {len(faqs)} FAQs for {business_id}")
            except json.JSONDecodeError:
                current_app.logger.warning(f"/get_faqs: Corrupted FAQ JSON for business {business_id}")
        else:
             session.pop('current_business_id', None) # Clear invalid session
             current_app.logger.warning(f"/get_faqs: Invalid business_id {business_id} in session.")

    return jsonify({'faqs': faqs})


@bp.route('/get_products', methods=['GET'])
def get_products_route():
    """Return products for the business identified by the session ID."""
    business_id = session.get('current_business_id')
    products = []
    if business_id:
        business = get_business_by_id(business_id)
        if business:
            try:
                products = json.loads(business['products_json'] or '[]')
                current_app.logger.debug(f"/get_products: Found {len(products)} products for {business_id}")
            except json.JSONDecodeError:
                current_app.logger.warning(f"/get_products: Corrupted Products JSON for business {business_id}")
        else:
            session.pop('current_business_id', None) # Clear invalid session
            current_app.logger.warning(f"/get_products: Invalid business_id {business_id} in session.")

    return jsonify({'products': products})