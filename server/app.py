from flask import Flask, current_app, jsonify, request
from werkzeug.exceptions import HTTPException

from config import CLIENT_APP_URLS, SECRET_KEY
from routes.auth import auth_bp
from routes.plans import plans_bp
from routes.profile import profile_bp
from routes.trips import trips_bp
from routes.uploads import uploads_bp
from services.trip_service import TripForbiddenError, TripNotFoundError, TripValidationError


def create_app() -> Flask:
    app = Flask(__name__)
    app.secret_key = SECRET_KEY

    @app.before_request
    def handle_options_request():
        if request.method == "OPTIONS":
            return ("", 204)

    @app.errorhandler(TripValidationError)
    def handle_validation_error(error):
        return jsonify({"error": str(error)}), 400

    @app.errorhandler(TripNotFoundError)
    def handle_not_found_error(error):
        return jsonify({"error": str(error)}), 404

    @app.errorhandler(TripForbiddenError)
    def handle_forbidden_error(error):
        return jsonify({"error": str(error)}), 403

    @app.errorhandler(ValueError)
    def handle_value_error(error):
        # Plain ValueErrors from services are bad client input; specific
        # subclasses (TripValidationError etc.) have their own handlers.
        return jsonify({"error": str(error)}), 400

    @app.errorhandler(Exception)
    def handle_unexpected_error(error):
        # Let HTTP exceptions (404 route misses, aborts, etc.) keep their status.
        if isinstance(error, HTTPException):
            return error
        current_app.logger.exception("Unhandled request error")
        return jsonify({"error": "internal server error"}), 500

    @app.after_request
    def add_cors_headers(response):
        request_origin = request.headers.get("Origin")
        if request_origin in CLIENT_APP_URLS:
            response.headers["Access-Control-Allow-Origin"] = request_origin
            response.headers["Vary"] = "Origin"

        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
        response.headers["Timing-Allow-Origin"] = "*"
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
