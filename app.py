# app.py
from flask import Flask
import os

# Import modules
from config import Config
import database
import routes

def create_app(config_class=Config):
    """Creates and configures the Flask application."""
    app = Flask(__name__, static_folder='static', template_folder='templates')
    app.config.from_object(config_class)

    # Ensure instance folder exists (if needed for Flask session files, etc.)
    try:
        os.makedirs(app.instance_path, exist_ok=True)
    except OSError:
        pass

    # Initialize Database
    with app.app_context():
        database.init_db_command(app) # Register 'flask init-db' command
        app.teardown_appcontext(database.close_db) # Register teardown function

    # Register Blueprints (for routes)
    app.register_blueprint(routes.bp)

    # Basic check route (optional)
    @app.route('/hello')
    def hello():
        return "Hello, World! App is running."

    return app