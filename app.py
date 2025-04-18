# app.py

from flask import Flask, render_template, url_for

# Create a Flask application instance
app = Flask(__name__)

# Define a route for the homepage
@app.route('/')
def index():
    """
    Renders the main index page of the customer service AI interface.
    Fetches a dynamic business name (placeholder for now) and passes it
    to the HTML template.
    """
    # In a real application, you would fetch the business name dynamically.
    # This could come from a database, a configuration file, or user input.
    dynamic_business_name = "Your Dynamic Business Name Here" # Replace with actual logic

    # Render the index.html template and pass the business name
    return render_template('index.html', business_name=dynamic_business_name)

# This block allows you to run the Flask development server directly
# when you execute this script.
if __name__ == '__main__':
    # Run the app in debug mode, which provides helpful error messages
    # and automatically reloads the server on code changes.
    app.run(debug=True)
