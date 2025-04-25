import sqlite3
import json
from flask import current_app, g

def get_db():
    """Opens a new database connection if there is none yet for the current application context."""
    if 'db' not in g:
        g.db = sqlite3.connect(
            current_app.config['DATABASE'],
            detect_types=sqlite3.PARSE_DECLTYPES
        )
        g.db.row_factory = sqlite3.Row # Return rows as dictionary-like objects
    return g.db

def close_db(e=None):
    """Closes the database again at the end of the request."""
    db = g.pop('db', None)
    if db is not None:
        db.close()

def init_db_command(app):
    """Defines a command line command 'flask init-db'."""
    @app.cli.command('init-db')
    def init_db():
        """Clear existing data and create new tables."""
        db = sqlite3.connect(current_app.config['DATABASE'])
        cursor = db.cursor()
        # Drop table first to ensure clean slate (optional)
        # cursor.execute("DROP TABLE IF EXISTS businesses")
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS businesses (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                original_filename TEXT,
                faqs_json TEXT,
                products_json TEXT,
                business_info_json TEXT
            )
        ''')
        db.commit()
        db.close()
        print("Initialized the database.")

def add_business_record(business_id, name, filename):
    """Adds a new business record with default empty JSON."""
    db = get_db()
    try:
        db.execute(
            '''INSERT INTO businesses (id, name, original_filename, faqs_json, products_json, business_info_json)
               VALUES (?, ?, ?, ?, ?, ?)''',
            (business_id, name, filename, '[]', '[]', '{}')
        )
        db.commit()
        print(f"DB: Added business {business_id} ({name})")
        return True
    except sqlite3.Error as e:
        print(f"DB Error adding business {business_id}: {e}")
        db.rollback() # Roll back changes on error
        return False

def update_business_ai_data(business_id, faqs=None, products=None, business_info=None):
    """Updates the generated AI data fields for a business."""
    db = get_db()
    updates = []
    params = []

    if faqs is not None:
        updates.append("faqs_json = ?")
        params.append(json.dumps(faqs))
    if products is not None:
        updates.append("products_json = ?")
        params.append(json.dumps(products))
    if business_info is not None:
        updates.append("business_info_json = ?")
        params.append(json.dumps(business_info))

    if not updates:
        return True # Nothing to update

    params.append(business_id)
    sql = f"UPDATE businesses SET {', '.join(updates)} WHERE id = ?"

    try:
        db.execute(sql, tuple(params))
        db.commit()
        print(f"DB: Updated AI data for business {business_id}")
        return True
    except sqlite3.Error as e:
        print(f"DB Error updating AI data for business {business_id}: {e}")
        db.rollback()
        return False

def get_business_by_id(business_id):
    """Retrieves a business record by its ID."""
    db = get_db()
    business = db.execute('SELECT * FROM businesses WHERE id = ?', (business_id,)).fetchone()
    return business # Returns a Row object or None

def delete_business_record(business_id):
    """Deletes a business record."""
    db = get_db()
    try:
        db.execute('DELETE FROM businesses WHERE id = ?', (business_id,))
        db.commit()
        print(f"DB: Deleted business {business_id}")
        return True
    except sqlite3.Error as e:
        print(f"DB Error deleting business {business_id}: {e}")
        db.rollback()
        return False