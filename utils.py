import os
import re
import csv
import PyPDF2
import docx
from flask import current_app
from langchain_text_splitters import RecursiveCharacterTextSplitter

def allowed_file(filename):
    """Check if the file extension is allowed based on app config."""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in current_app.config['ALLOWED_EXTENSIONS']

def extract_text_from_file(file_path):
    """Extract text content from uploaded files based on their type"""
    _, file_extension = os.path.splitext(file_path)
    file_extension = file_extension.lower()
    text_content = ""
    filename_for_log = os.path.basename(file_path) # For logging

    try:
        if file_extension == '.pdf':
            with open(file_path, 'rb') as file:
                reader = PyPDF2.PdfReader(file)
                for page in reader.pages:
                    page_text = page.extract_text()
                    if page_text:
                        text_content += page_text + "\n"
        elif file_extension == '.docx':
            doc = docx.Document(file_path)
            for para in doc.paragraphs:
                text_content += para.text + "\n"
        elif file_extension == '.doc':
            # ... (keep basic doc logic)
            current_app.logger.warning(f"Basic .doc file detected ({filename_for_log}). Extraction might be limited.")
            try:
                 with open(file_path, 'r', encoding='utf-8', errors='ignore') as file:
                     text_content = file.read()
                 if not text_content.strip():
                     text_content = "[Content extraction for .doc format is limited]"
            except Exception:
                 text_content = "[Content extraction for .doc format failed]"
        elif file_extension == '.txt':
             with open(file_path, 'r', encoding='utf-8', errors='ignore') as file:
                text_content = file.read()
        elif file_extension == '.csv':
             try:
                 with open(file_path, 'r', encoding='utf-8', errors='ignore') as file:
                     reader = csv.reader(file)
                     for row in reader:
                         text_content += " ".join(cell.strip() for cell in row if cell) + "\n"
             except Exception as e:
                 current_app.logger.error(f"Error reading CSV {filename_for_log}: {str(e)}")
                 text_content = f"[Error extracting text from CSV: {str(e)}]"

    except Exception as e:
        current_app.logger.error(f"Error extracting text from {filename_for_log}: {str(e)}")
        text_content = "" # Or: f"[Error extracting text: {str(e)}]"

    # Basic cleaning
    text_content = re.sub(r'\s+', ' ', text_content).strip()
    return text_content

def chunk_text(text, chunk_size=500, chunk_overlap=50):
    """Splits text into smaller overlapping chunks using LangChain."""
    if not text:
        return []

    # Initialize the splitter
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        length_function=len, # Use standard length function
        # Try to split by common separators first
        separators=["\n\n", "\n", ". ", ", ", " ", ""],
        is_separator_regex=False,
    )

    # Split the text
    try:
        chunks = text_splitter.split_text(text)
        # Optional: Log the number of chunks created
        current_app.logger.debug(f"Split text into {len(chunks)} chunks.")
        return chunks
    except Exception as e:
        current_app.logger.error(f"Error during LangChain text splitting: {e}")
        # Fallback or return empty? Returning empty for safety.
        return []
        