# Import necessary modules for the Flask web application
from flask import Flask, render_template, request, redirect, url_for, session, jsonify, flash, g
from flask_sqlalchemy import SQLAlchemy  # Database ORM (Object-Relational Mapping) for easier database operations
from werkzeug.security import generate_password_hash, check_password_hash  # For secure password hashing
from datetime import datetime  # For handling dates and times
import os  # For file system operations

# Create the Flask application instance
app = Flask(__name__)

# Configure the Flask app with secret key for session security and database settings
app.config['SECRET_KEY'] = 'change-me-to-a-secure-random-key'  # Used for session encryption
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + os.path.join(app.root_path, 'database.db')  # SQLite database file location
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False  # Disable modification tracking for performance

# Initialize the database with the Flask app
db = SQLAlchemy(app)

# Define the User model (database table) for storing user information
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)  # Unique identifier for each user
    username = db.Column(db.String(80), unique=True, nullable=False)  # Username, must be unique and not empty
    password_hash = db.Column(db.String(255), nullable=False)  # Hashed password for security
    applications = db.relationship('Application', backref='user', lazy=True)  # Relationship to applications

# Define the Application model for storing university application data
class Application(db.Model):
    id = db.Column(db.Integer, primary_key=True)  # Unique identifier for each application
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)  # Links to the user who owns this application
    university = db.Column(db.String(255), nullable=False)  # University name
    program = db.Column(db.String(255), nullable=False)  # Program/major name
    country = db.Column(db.String(120), nullable=False)  # Country where university is located
    deadline = db.Column(db.Date, nullable=False)  # Application deadline date
    status = db.Column(db.String(20), nullable=False, default='Pending')  # Status: Pending, Applied, Accepted, Rejected
    notes = db.Column(db.Text, nullable=True)  # Optional notes about the application
    created_at = db.Column(db.DateTime, default=datetime.utcnow)  # Timestamp when application was created

# Define the CustomEvent model for storing custom calendar events
class CustomEvent(db.Model):
    id = db.Column(db.Integer, primary_key=True)  # Unique identifier for each event
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)  # Links to the user who owns this event
    title = db.Column(db.String(255), nullable=False)  # Event title
    event_type = db.Column(db.String(50), nullable=False)  # Type: interview, submission, reminder, etc.
    date = db.Column(db.Date, nullable=False)  # Date of the event
    description = db.Column(db.Text, nullable=True)  # Optional description
    created_at = db.Column(db.DateTime, default=datetime.utcnow)  # Timestamp when event was created

# Function to create database tables and add initial data
def create_database():
    db.create_all()  # Create all database tables based on the models above
    
    # Create a default user if none exists (for testing purposes)
    if User.query.filter_by(username='student').first() is None:
        user = User(username='student', password_hash=generate_password_hash('student123'))
        db.session.add(user)
        db.session.commit()

# Function that runs before every request to load the current user
@app.before_request
def load_current_user():
    g.user = None  # Global variable to store current user
    if 'user_id' in session:  # Check if user is logged in (user_id in session)
        g.user = User.query.get(session['user_id'])  # Load user from database

# Route for the root URL - redirects to dashboard if logged in, otherwise to login
@app.route('/')
def index():
    if g.user:  # If user is logged in
        return redirect(url_for('dashboard'))  # Go to dashboard
    return redirect(url_for('login'))  # Otherwise go to login page

# Route for login page - handles both GET (show form) and POST (process login)
@app.route('/login', methods=['GET', 'POST'])
def login():
    if g.user:  # If already logged in, redirect to dashboard
        return redirect(url_for('dashboard'))

    if request.method == 'POST':  # If form was submitted
        username = request.form.get('username', '').strip()  # Get username from form
        password = request.form.get('password', '')  # Get password from form
        user = User.query.filter_by(username=username).first()  # Find user in database

        if user and check_password_hash(user.password_hash, password):  # Check if user exists and password is correct
            session.clear()  # Clear any existing session
            session['user_id'] = user.id  # Store user ID in session (logs them in)
            return redirect(url_for('dashboard'))  # Redirect to dashboard

        flash('Invalid username or password.', 'error')  # Show error message

    return render_template('login.html')  # Show login form

# Route for registration page - handles user account creation
@app.route('/register', methods=['GET', 'POST'])
def register():
    if g.user:  # If already logged in, redirect to dashboard
        return redirect(url_for('dashboard'))

    if request.method == 'POST':  # If form was submitted
        username = request.form.get('username', '').strip()  # Get form data
        password = request.form.get('password', '')
        confirm = request.form.get('confirm', '')

        if not username or not password:  # Validate required fields
            flash('Please fill in both username and password.', 'error')
        elif password != confirm:  # Check if passwords match
            flash('Passwords do not match.', 'error')
        elif User.query.filter_by(username=username).first():  # Check if username already exists
            flash('This username is already taken.', 'error')
        else:  # All validation passed
            user = User(username=username, password_hash=generate_password_hash(password))  # Create new user
            db.session.add(user)  # Add to database
            db.session.commit()  # Save changes
            session.clear()
            session['user_id'] = user.id  # Log them in
            return redirect(url_for('dashboard'))  # Redirect to dashboard

    return render_template('register.html')  # Show registration form

# Route for logout - clears session and redirects to login
@app.route('/logout')
def logout():
    session.clear()  # Remove user from session (log them out)
    return redirect(url_for('login'))  # Redirect to login page

# Route for dashboard - shows user's applications and stats
@app.route('/dashboard')
def dashboard():
    if not g.user:  # Check if user is logged in
        return redirect(url_for('login'))  # If not, redirect to login
    return render_template('dashboard.html', user=g.user)  # Show dashboard with user data

# Route for profile page - allows password changes
@app.route('/profile')
def profile():
    if not g.user:  # Check authentication
        return redirect(url_for('login'))
    return render_template('profile.html', user=g.user)  # Show profile page

# Route for changing password - processes the password change form
@app.route('/change_password', methods=['POST'])
def change_password():
    if not g.user:  # Check authentication
        return redirect(url_for('login'))

    # Get form data
    current_password = request.form.get('current_password', '')
    new_password = request.form.get('new_password', '')
    confirm_password = request.form.get('confirm_password', '')

    # Validate current password
    if not check_password_hash(g.user.password_hash, current_password):
        flash('Current password is incorrect.', 'error')
    elif new_password != confirm_password:  # Check if new passwords match
        flash('New passwords do not match.', 'error')
    elif len(new_password) < 6:  # Check minimum length
        flash('New password must be at least 6 characters long.', 'error')
    else:  # All validation passed
        g.user.password_hash = generate_password_hash(new_password)  # Hash new password
        db.session.commit()  # Save to database
        flash('Password changed successfully.', 'success')  # Show success message

    return redirect(url_for('profile'))  # Redirect back to profile

# Route for calendar page - shows calendar with deadlines and events
@app.route('/calendar')
def calendar():
    if not g.user:  # Check authentication
        return redirect(url_for('login'))
    return render_template('calendar.html')  # Show calendar page

# API route for custom events - handles GET (list events) and POST (create event)
@app.route('/api/custom_events', methods=['GET', 'POST'])
def custom_events_api():
    if not g.user:  # Check authentication
        return jsonify({'error': 'Unauthorized'}), 401  # Return error if not logged in

    if request.method == 'GET':  # If requesting events list
        events = CustomEvent.query.filter_by(user_id=g.user.id).all()  # Get user's events
        return jsonify([{  # Return events as JSON
            'id': event.id,
            'title': event.title,
            'event_type': event.event_type,
            'date': event.date.isoformat(),  # Convert date to string format
            'description': event.description,
        } for event in events])

    # If POST (creating new event)
    data = request.get_json() or {}  # Get JSON data from request
    try:
        event = CustomEvent(  # Create new event object
            user_id=g.user.id,
            title=data['title'].strip(),
            event_type=data['event_type'].strip(),
            date=datetime.fromisoformat(data['date']).date(),  # Convert string to date
            description=data.get('description', '').strip(),
        )
        db.session.add(event)  # Add to database
        db.session.commit()  # Save
        return jsonify({  # Return the created event
            'id': event.id,
            'title': event.title,
            'event_type': event.event_type,
            'date': event.date.isoformat(),
            'description': event.description,
        }), 201  # 201 = Created status
    except Exception:  # If something went wrong
        return jsonify({'error': 'Invalid request body.'}), 400  # Return error

# API route for applications - handles GET (list applications) and POST (create application)
@app.route('/api/applications', methods=['GET', 'POST'])
def applications_api():
    if not g.user:  # Check authentication
        return jsonify({'error': 'Unauthorized'}), 401

    if request.method == 'GET':  # If requesting applications list
        applications = Application.query.filter_by(user_id=g.user.id).order_by(Application.created_at.desc()).all()
        return jsonify([serialize_application(app) for app in applications])  # Return serialized applications

    # If POST (creating new application)
    data = request.get_json() or {}  # Get JSON data
    try:
        application = Application(  # Create new application
            user_id=g.user.id,
            university=data['university'].strip(),
            program=data['program'].strip(),
            country=data['country'].strip(),
            deadline=datetime.fromisoformat(data['deadline']).date(),
            status=data.get('status', 'Pending'),
            notes=data.get('notes', '').strip(),
        )
        db.session.add(application)  # Add to database
        db.session.commit()  # Save
        return jsonify(serialize_application(application)), 201  # Return created application
    except Exception:
        return jsonify({'error': 'Invalid request body.'}), 400

# API route for updating application status
@app.route('/api/applications/<int:app_id>/status', methods=['POST'])
def update_application_status(app_id):
    if not g.user:  # Check authentication
        return jsonify({'error': 'Unauthorized'}), 401

    application = Application.query.filter_by(id=app_id, user_id=g.user.id).first()  # Find application
    if not application:  # If not found or doesn't belong to user
        return jsonify({'error': 'Application not found.'}), 404

    data = request.get_json() or {}
    new_status = data.get('status', '').strip()
    if new_status not in ['Pending', 'Applied', 'Accepted', 'Rejected']:  # Validate status
        return jsonify({'error': 'Invalid status.'}), 400

    application.status = new_status  # Update status
    db.session.commit()  # Save
    return jsonify(serialize_application(application))  # Return updated application

# API route for getting current user info
@app.route('/api/user', methods=['GET'])
def get_user():
    if not g.user:  # Check authentication
        return jsonify({'error': 'Unauthorized'}), 401
    return jsonify({'username': g.user.username})  # Return username

# Helper function to convert application object to dictionary for JSON response
def serialize_application(application):
    return {
        'id': application.id,
        'university': application.university,
        'program': application.program,
        'country': application.country,
        'deadline': application.deadline.isoformat(),  # Convert date to string
        'status': application.status,
        'notes': application.notes or '',  # Handle None values
    }

# Main entry point - runs when script is executed directly
if __name__ == '__main__':
    with app.app_context():  # Create database tables within app context
        create_database()
    app.run(debug=True)  # Start the Flask development server with debug mode
