from app import create_app
from config import Config
import os

app = create_app()

# first run flask init-db once before running # python run.py.

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    # Debug mode is controlled by Config.DEBUG now
    app.run(debug=Config.DEBUG, host='0.0.0.0', port=port)