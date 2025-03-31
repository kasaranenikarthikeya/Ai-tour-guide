from flask import Flask, render_template, jsonify, redirect, url_for, flash, request
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_login import LoginManager, UserMixin, login_user, login_required, logout_user, current_user
from werkzeug.security import generate_password_hash, check_password_hash
import requests
from datetime import datetime
import time
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY')
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URI')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
    'pool_pre_ping': True,
    'pool_recycle': 3600,
}

db = SQLAlchemy(app)
migrate = Migrate(app, db)
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'

API_KEY = os.getenv('API_KEY')

class User(UserMixin, db.Model):
    __tablename__ = 'user'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    password = db.Column(db.String(255), nullable=False)

    def set_password(self, password):
        self.password = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password, password)

class Favorite(db.Model):
    __tablename__ = 'favorite'
    __table_args__ = (
        db.UniqueConstraint('user_id', 'state', 'place_name', 'category', name='unique_favorite'),
    )
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    state = db.Column(db.String(100), nullable=False)
    place_name = db.Column(db.String(300), nullable=False)
    category = db.Column(db.String(100), nullable=False)
    date_added = db.Column(db.DateTime, default=datetime.utcnow)

@login_manager.user_loader
def load_user(user_id):
    max_retries = 3
    for attempt in range(max_retries):
        try:
            return User.query.get(int(user_id))
        except Exception as e:
            if "server closed the connection unexpectedly" in str(e):
                print(f"Database connection error, retrying {attempt + 1}/{max_retries}: {e}")
                time.sleep(2)
                db.session.rollback()
                continue
            else:
                print(f"Error loading user {user_id}: {e}")
                return None
    flash("Unable to connect to the database. Please try again later.")
    return None

@app.route("/favorites", methods=["GET"])
@login_required
def favorites():
    try:
        favorite_places = Favorite.query.filter_by(user_id=current_user.id)\
                                       .order_by(Favorite.date_added.desc())\
                                       .all()
        print(f"Current user ID: {current_user.id}")
        print(f"Found {len(favorite_places)} favorites")
        for fav in favorite_places:
            print(f"ID: {fav.id}, State: {fav.state or 'None'}, Category: {fav.category or 'None'}, Place: {fav.place_name or 'None'}")
        return render_template("favorites.html", favorites=favorite_places)
    except Exception as e:
        print(f"Error fetching favorites: {str(e)}")
        flash("Error loading favorites. Please try again later.")
        return render_template("favorites.html", favorites=[])

@app.route("/login", methods=["GET", "POST"])
def login():
    if current_user.is_authenticated:
        return redirect(url_for('index'))
    if request.method == "POST":
        username = request.form.get("username")
        password = request.form.get("password")
        user = User.query.filter_by(username=username).first()
        if user and user.check_password(password):
            login_user(user)
            return redirect(url_for('index'))
        flash("Invalid username or password")
    return render_template("login.html")

@app.route("/register", methods=["GET", "POST"])
def register():
    if current_user.is_authenticated:
        return redirect(url_for('index'))
    if request.method == "POST":
        username = request.form.get("username")
        password = request.form.get("password")
        if User.query.filter_by(username=username).first():
            flash("Username already exists")
        else:
            user = User(username=username)
            user.set_password(password)
            db.session.add(user)
            db.session.commit()
            flash("Registration successful! Please log in.")
            return redirect(url_for('login'))
    return render_template("register.html")

@app.route("/logout")
@login_required
def logout():
    logout_user()
    return redirect(url_for('login'))

@app.route("/", methods=["GET"])
@login_required
def index():
    return render_template("index.html")

@app.route("/states", methods=["GET"])
@login_required
def states():
    states_list = fetch_states_from_mistral()
    return render_template("states.html", states=states_list)

@app.route("/places/<state>", methods=["GET"])
@login_required
def places(state):
    category = request.args.get("category", "all")
    places_list = get_famous_places(state, category)
    return render_template("places.html", state=state, places=places_list, categories=CATEGORIES)

@app.route("/categories", methods=["GET"])
@login_required
def categories():
    states_list = fetch_states_from_mistral()
    return render_template("categories.html", categories=CATEGORIES, states=states_list)

@app.route("/about", methods=["GET"])
def about():
    return render_template("about.html")

@app.route("/api/states", methods=["GET"])
@login_required
def get_states():
    try:
        states = fetch_states_from_mistral()
        if not states:
            return jsonify({"error": "Failed to fetch states"}), 500
        return jsonify({"states": states})
    except Exception as e:
        print(f"Error in get_states: {e}")
        return jsonify({"error": "Failed to fetch states"}), 500

@app.route("/api/search", methods=["POST"])
@login_required
def search():
    state = request.json.get("state", "").strip()
    category = request.json.get("category", "all")
    if not state:
        return jsonify({"error": "State name is required"}), 400
    try:
        places = get_famous_places(state, category)
        if not places:
            return jsonify({"places": []}), 200  # Return empty list instead of error
        return jsonify({"places": places})
    except Exception as e:
        print(f"Error in search: {e}")
        return jsonify({"error": "Failed to fetch places"}), 500

@app.route("/api/favorites/list", methods=["GET"])
@login_required
def get_favorites_list():
    try:
        favorites = Favorite.query.filter_by(user_id=current_user.id).all()
        favorites_list = [
            {
                'id': fav.id,
                'state': fav.state,
                'place_name': fav.place_name,
                'category': fav.category
            } for fav in favorites
        ]
        return jsonify({'favorites': favorites_list}), 200
    except Exception as e:
        print(f"Error fetching favorites list: {str(e)}")
        return jsonify({'error': 'Failed to fetch favorites'}), 500

@app.route("/api/favorites", methods=["POST"])
@login_required
def add_favorite():
    try:
        data = request.json
        state = data.get("state")
        place_name = data.get("place_name")
        category = data.get("category")
        print(f"Received: state={state}, place_name={place_name}, category={category}")
        if not all([state, place_name, category]):
            return jsonify({"error": "Missing required fields"}), 400
        if Favorite.query.filter_by(user_id=current_user.id, state=state, place_name=place_name, category=category).first():
            print(f"Favorite already exists for user {current_user.id}")
            return jsonify({"message": "Favorite already exists"}), 200
        favorite = Favorite(user_id=current_user.id, state=state, place_name=place_name, category=category)
        db.session.add(favorite)
        db.session.commit()
        print(f"Added favorite ID: {favorite.id}")
        return jsonify({"message": "Favorite added successfully", "id": favorite.id}), 201
    except Exception as e:
        print(f"Error adding favorite: {e}")
        db.session.rollback()
        return jsonify({"error": "Failed to add favorite"}), 500

@app.route("/api/favorites/<int:id>", methods=["DELETE"])
@login_required
def delete_favorite(id):
    try:
        print(f"Attempting to delete favorite ID: {id} for user ID: {current_user.id}")
        favorite = Favorite.query.filter_by(id=id, user_id=current_user.id).first()
        if not favorite:
            print(f"No favorite found with ID: {id} for user ID: {current_user.id}")
            return jsonify({"error": "Favorite not found"}), 404
        db.session.delete(favorite)
        db.session.commit()
        print(f"Successfully deleted favorite ID: {id}")
        return jsonify({"message": "Favorite deleted successfully"}), 200
    except Exception as e:
        print(f"Error deleting favorite ID: {id}: {str(e)}")
        db.session.rollback()
        return jsonify({"error": f"Failed to delete favorite: {str(e)}"}), 500

def call_mistral_api(prompt):
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }
    data = {
        "model": "mistral-medium",
        "messages": [{"role": "user", "content": prompt}]
    }
    try:
        response = requests.post(
            "https://api.mistral.ai/v1/chat/completions",
            json=data,
            headers=headers,
            timeout=15
        )
        response.raise_for_status()
        result = response.json()
        choices = result.get("choices", [])
        if not choices:
            raise ValueError("No choices returned from API")
        return choices[0]["message"]["content"]
    except requests.exceptions.RequestException as e:
        print(f"Network error calling Mistral API: {e}")
        return "Error fetching data. Please try again later."
    except Exception as e:
        print(f"Error calling Mistral API: {e}")
        return "Error fetching data. Please try again later."

def fetch_states_from_mistral():
    prompt = "List all 50 US states in bullet points in English."
    states_text = call_mistral_api(prompt)
    if "Error" in states_text:
        return []
    states = [s.strip("- ").strip() for s in states_text.split("\n") if s.strip()]
    return states

def get_famous_places(state, category="all"):
    category_prompts = {
        "all": f"List 10 famous tourist places in {state} in bullet points in English.",
        "monuments": f"List 10 famous monuments in {state} in bullet points in English.",
        "parks": f"List 10 famous parks or nature spots in {state} in bullet points in English.",
        "museums": f"List 10 famous museums in {state} in bullet points in English.",
        "temples": f"List 10 famous temples or religious sites in {state} in bullet points in English.",
        "beaches": f"List 10 famous beaches in {state} in bullet points in English.",
        "historical": f"List 10 famous historical sites in {state} in bullet points in English."
    }
    prompt = category_prompts.get(category, category_prompts["all"])
    places_text = call_mistral_api(prompt)
    if "Error" in places_text:
        return []
    places = [p.strip("- ").strip() for p in places_text.split("\n") if p.strip()]
    return [{"name": place, "category": category.capitalize() if category != "all" else "All"} for place in places[:10]]

CATEGORIES = {
    "all": "All Categories",
    "mountains": "Monuntains",
    "parks": "Parks",
    "museums": "Museums",
    "temples": "Temples",
    "beaches": "Beaches",
    "historical": "Historical Sites"
}

if __name__ == "__main__":
    port = int(os.getenv('PORT', 5000))  # Default to 5000 locally
    app.run(host='0.0.0.0', port=port, debug=True)
