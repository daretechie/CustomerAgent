import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    SECRET_KEY = os.environ.get("FLASK_SECRET_KEY", "a_very_secret_default_key")
    OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
    DATABASE = os.path.join(os.path.abspath(os.path.dirname(__file__)), 'business_data.db')

    # --- ChromaDB Persistence Path ---
    CHROMA_PERSIST_DIR = os.path.join(os.path.abspath(os.path.dirname(__file__)), 'chroma_db_persist')
    CHROMA_COLLECTION_NAME = "business_docs_collection"
    # --------------------------------

    UPLOAD_FOLDER = os.path.join(os.path.abspath(os.path.dirname(__file__)), 'uploads')
    ALLOWED_EXTENSIONS = {'pdf', 'doc', 'docx', 'txt', 'csv'}
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16MB limit
    DEBUG = True # Set to True for development, False for production

    # AI Model Config
    OPENAI_EMBEDDING_MODEL = "text-embedding-3-small"
    OPENAI_CHAT_MODEL = "gpt-4o" # Or "gpt-3.5-turbo"

# --- Create directories if they don't exist ---
if not os.path.exists(Config.UPLOAD_FOLDER):
    os.makedirs(Config.UPLOAD_FOLDER)
if not os.path.exists(Config.CHROMA_PERSIST_DIR):
    os.makedirs(Config.CHROMA_PERSIST_DIR)
# -------------------------------------------

# Validate OpenAI key early
if not Config.OPENAI_API_KEY:
    raise ValueError("ERROR: OPENAI_API_KEY environment variable not set.")