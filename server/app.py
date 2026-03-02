from flask import Flask, jsonify, request

from config import CLIENT_APP_URLS, SECRET_KEY
from routes.auth import auth_bp
from routes.plans import plans_bp
from routes.profile import profile_bp
from routes.trips import trips_bp
from routes.uploads import uploads_bp


def create_app() -> Flask:
    app = Flask(__name__)
    app.secret_key = SECRET_KEY

    @app.after_request
    def add_cors_headers(response):
        request_origin = request.headers.get("Origin")
        if request_origin in CLIENT_APP_URLS:
            response.headers["Access-Control-Allow-Origin"] = request_origin
            response.headers["Vary"] = "Origin"

        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, DELETE, OPTIONS"
        return response

    @app.route("/", methods=["GET"])
    def health():
        return jsonify({"status": "ok"}), 200

    app.register_blueprint(auth_bp)
    app.register_blueprint(plans_bp)
    app.register_blueprint(profile_bp)
    app.register_blueprint(trips_bp)
    app.register_blueprint(uploads_bp)

    return app
