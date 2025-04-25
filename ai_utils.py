import openai
import json
import time
import chromadb
from chromadb.utils import embedding_functions
from flask import current_app # Use current_app to access config

try:
    openai.api_key = current_app.config['OPENAI_API_KEY']

    # Setup ChromaDB client and embedding function
    chroma_client = chromadb.PersistentClient(path=current_app.config['CHROMA_PERSIST_DIR'])
    openai_ef = embedding_functions.OpenAIEmbeddingFunction(
        api_key=current_app.config["OPENAI_API_KEY"],
        model_name=current_app.config["OPENAI_EMBEDDING_MODEL"]
    )

    # Get or create the collection
    vector_collection = chroma_client.get_or_create_collection(
        name=current_app.config["CHROMA_COLLECTION_NAME"],
        embedding_function=openai_ef,
        metadata={"hnsw:space": "cosine"} # Using cosine distance
    )
    current_app.logger.info(f"ChromaDB collection '{current_app.config['CHROMA_COLLECTION_NAME']}' loaded/created.")

except Exception as e:
     current_app.logger.error(f"Failed to initialize AI Clients (OpenAI/ChromaDB): {e}")
    
     vector_collection = None 

# --- Embedding ---
def generate_embedding(text_chunk):
    """Generate embedding for a single text chunk using OpenAI."""
    max_retries = 3
    model = current_app.config['OPENAI_EMBEDDING_MODEL']
    for attempt in range(max_retries):
        try:
            if not text_chunk or not text_chunk.strip():
                 current_app.logger.warning("Attempted to embed empty chunk.")
                 return None
            response = openai.embeddings.create(model=model, input=text_chunk)
            return response.data[0].embedding
        except openai.RateLimitError as e:
            current_app.logger.warning(f"OpenAI Rate limit exceeded, retrying in {2**attempt}s: {e}")
            time.sleep(2**attempt)
        except Exception as e:
            current_app.logger.error(f"OpenAI Error generating embedding for chunk: {str(e)}")
            return None # Don't retry other errors immediately
    current_app.logger.error(f"Failed to generate embedding after {max_retries} retries.")
    return None

# These functions now just RETURN the data, the route handles DB update
def generate_faqs_from_text(text_content):
    """Generate FAQs based on text content using OpenAI."""
    if not text_content: return []
    current_app.logger.info(f"AI: Generating FAQs...")
    model = current_app.config['OPENAI_CHAT_MODEL']
    try:
        context_limit = 8000 # Define or get from config
        limited_context = text_content[:context_limit]
        response = openai.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": """You are an AI assistant that generates helpful FAQs..."""}, # Keep full prompt
                {"role": "user", "content": f"Document Text:\n```\n{limited_context}\n```"}
            ],
            response_format={"type": "json_object"}
        )
        faqs_data = json.loads(response.choices[0].message.content)
        generated_faqs = faqs_data.get('faqs', [])
        current_app.logger.info(f"AI: Generated {len(generated_faqs)} FAQs.")
        return generated_faqs
    except Exception as e:
        current_app.logger.error(f"AI Error generating FAQs: {str(e)}")
        return []

def extract_business_data_from_text(text_content):
    """Extract structured business data (products, info) from text."""
    if not text_content: return {'products': [], 'business_info': {}}
    current_app.logger.info(f"AI: Extracting business data...")
    model = current_app.config['OPENAI_CHAT_MODEL']
    try:
        context_limit = 8000 # Define or get from config
        limited_context = text_content[:context_limit]
        response = openai.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": """You are an AI assistant extracting structured business data..."""}, # Keep full prompt
                {"role": "user", "content": f"Document Text:\n```\n{limited_context}\n```"}
            ],
            response_format={"type": "json_object"}
        )
        business_data = json.loads(response.choices[0].message.content)
        extracted_data = {
            'products': business_data.get('products', []),
            'business_info': business_data.get('business_info', {})
        }
        current_app.logger.info(f"AI: Extracted {len(extracted_data['products'])} products/services.")
        return extracted_data
    except Exception as e:
        current_app.logger.error(f"AI Error extracting business data: {str(e)}")
        return {'products': [], 'business_info': {}}

# --- Vector Database Interaction (Implemented with ChromaDB) ---
def add_document_chunks_to_vector_db(business_id, filename, chunks):
    """Adds text chunks and embeddings to the ChromaDB collection."""
    if vector_collection is None:
        current_app.logger.error("VDB: ChromaDB vector collection not initialized. Cannot add document.")
        return False

    current_app.logger.info(f"VDB: Preparing {len(chunks)} chunks for {business_id} ({filename})")
    embeddings_data = []
    documents_data = []
    metadata_data = []
    ids_data = []

    # Generate embeddings first (this can be slow!)
    # Comment: Ideally, this embedding generation loop should be in a background task.
    for i, chunk in enumerate(chunks):
        # Generate unique ID for each chunk
        # Using filename and index makes it easier to potentially remove/update later
        chunk_id = f"{business_id}_{filename}_{i}"
        ids_data.append(chunk_id)

        embedding = generate_embedding(chunk) # Uses the function above
        if embedding:
            embeddings_data.append(embedding)
            documents_data.append(chunk)
            # Add relevant metadata for filtering
            metadata_data.append({"business_id": business_id, "filename": filename, "chunk_index": i})
        else:
            current_app.logger.warning(f"VDB: Skipping chunk {i} for {filename} due to embedding failure.")
            # Remove corresponding ID if embedding failed
            ids_data.pop()


    if not documents_data:
        current_app.logger.warning("VDB: No valid embeddings generated, nothing to add.")
        return False # Or True? Arguably not a failure of this function itself.

    # --- Add to ChromaDB ---
    try:
        current_app.logger.info(f"VDB: Adding {len(ids_data)} chunks to ChromaDB collection...")
        vector_collection.add(
            embeddings=embeddings_data,
            documents=documents_data,
            metadatas=metadata_data,
            ids=ids_data
        )
        current_app.logger.info(f"VDB: Successfully added chunks for {business_id} ({filename})")
        return True
    except Exception as e:
        current_app.logger.error(f"VDB: Error adding chunks to ChromaDB for {business_id}: {e}")
        # Consider implications: Partial add? Need cleanup?
        return False
    # ------------------------

def query_vector_db(business_id, query_text, k=3):
    """Queries the ChromaDB collection for relevant chunks based on business_id."""
    if vector_collection is None:
        current_app.logger.error("VDB: ChromaDB vector collection not initialized. Cannot query.")
        return []

    current_app.logger.info(f"VDB: Querying for '{business_id}' with query: '{query_text[:50]}...'")
    query_embedding = generate_embedding(query_text) # Uses function above

    if not query_embedding:
        current_app.logger.error("VDB: Failed to generate query embedding.")
        return []

    # --- Query ChromaDB ---
    try:
        results = vector_collection.query(
            query_embeddings=[query_embedding],
            n_results=k,
            where={"business_id": business_id} # Filter results for the specific business
        )
        # ChromaDB returns results['documents'] as a list containing one list of docs
        retrieved_docs = results.get('documents', [[]])[0]
        current_app.logger.info(f"VDB: Retrieved {len(retrieved_docs)} chunks from ChromaDB for {business_id}")
        return retrieved_docs # Return the text content of the chunks
    except Exception as e:
        current_app.logger.error(f"VDB: Error querying ChromaDB for {business_id}: {e}")
        return []
    # ----------------------


# --- RAG Response Generation (No changes needed from previous version) ---
def generate_rag_response(business_name, user_message, retrieved_chunks, faqs, products):
    """Generates the final AI response using RAG."""
    current_app.logger.info("AI: Generating RAG response...")
    model = current_app.config['OPENAI_CHAT_MODEL']

    # Build Context String (same logic as before)
    context_string = f"Retrieved context from business documents for {business_name}:\n"
    # ... (rest of context building logic) ...
    if retrieved_chunks:
        for i, chunk in enumerate(retrieved_chunks):
            context_string += f"Chunk {i+1}: {chunk}\n---\n"
    else:
        context_string += "(No specific context found in documents for this query.)\n"

    if not retrieved_chunks and faqs:
         context_string += "\nGeneral FAQs:\n" + json.dumps(faqs, indent=2) + "\n"
    if products:
         context_string += "\nProduct/Service List Summary:\n" + json.dumps(products, indent=2) + "\n"


    # Call LLM (same logic as before)
    system_prompt = f"""You are FashBot, an AI customer support agent for '{business_name}'... (rest of prompt)

    --- Context Start ---
    {context_string[:12000]}
    --- Context End ---
    """
    try:
        response = openai.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message}
            ],
            temperature=0.5
        )
        ai_response = response.choices[0].message.content
        current_app.logger.info("AI: RAG response generated.")
        return ai_response
    except Exception as e:
        current_app.logger.error(f"AI Error generating RAG response: {str(e)}")
        return "I'm sorry, there was an issue generating a response right now."