from __future__ import annotations

from flask import Blueprint, current_app, jsonify, request, session

from services.auth_service import get_authenticated_user
from services.trip_service import (
    TripForbiddenError,
    TripNotFoundError,
    TripValidationError,
    add_activity,
    add_lodging,
    create_trip,
    delete_trip,
    get_trip,
    list_trips,
)

trips_bp = Blueprint("trips", __name__)

@trips_bp.route("/trips", methods=["GET", "OPTIONS"])
def get_trips():
    if request.method == "OPTIONS":
        return ("", 204)

    viewer = get_authenticated_user(session)
    viewer_user_id = viewer["user_id"] if viewer else None

    try:
        trips = list_trips(viewer_user_id=viewer_user_id)
        return jsonify({"trips": trips}), 200
    except Exception as error:
        current_app.logger.exception("List trips failed")
        return jsonify({"error": f"list trips failed: {str(error)}"}), 500


@trips_bp.route("/trips/<int:trip_id>", methods=["GET", "OPTIONS"])
def get_trip_by_id(trip_id: int):
    if request.method == "OPTIONS":
        return ("", 204)

    viewer = get_authenticated_user(session)
    viewer_user_id = viewer["user_id"] if viewer else None

    try:
        trip = get_trip(trip_id=trip_id, viewer_user_id=viewer_user_id)
        if not trip:
            return jsonify({"error": "trip not found"}), 404

        return jsonify({"trip": trip}), 200
    except Exception as error:
        current_app.logger.exception("Get trip failed")
        return jsonify({"error": f"get trip failed: {str(error)}"}), 500


@trips_bp.route("/trips/<int:trip_id>", methods=["DELETE"])
def delete_trip_by_id(trip_id: int):
    user = get_authenticated_user(session)
    if not user:
        return jsonify({"error": "authentication required"}), 401

    try:
        delete_trip(trip_id=trip_id, owner_user_id=user["user_id"])
        return jsonify({"message": "trip deleted"}), 200
    except TripNotFoundError as error:
        return jsonify({"error": str(error)}), 404
    except TripForbiddenError as error:
        return jsonify({"error": str(error)}), 403
    except Exception as error:
        current_app.logger.exception("Delete trip failed")
        return jsonify({"error": f"delete trip failed: {str(error)}"}), 500


@trips_bp.route("/trips", methods=["POST", "OPTIONS"])
def create_trip_route():
    if request.method == "OPTIONS":
        return ("", 204)

    user = get_authenticated_user(session)
    if not user:
        return jsonify({"error": "authentication required"}), 401

    payload = request.get_json(silent=True) or {}
    try:
        trip = create_trip(owner_user_id=user["user_id"], payload=payload)
        return jsonify({"message": "trip created", "trip": trip}), 201
    except TripValidationError as error:
        return jsonify({"error": str(error)}), 400
    except Exception as error:
        current_app.logger.exception("Create trip failed")
        return jsonify({"error": f"create trip failed: {str(error)}"}), 500


@trips_bp.route("/trips/<int:trip_id>/lodgings", methods=["POST", "OPTIONS"])
def add_lodging_route(trip_id: int):
    if request.method == "OPTIONS":
        return ("", 204)

    user = get_authenticated_user(session)
    if not user:
        return jsonify({"error": "authentication required"}), 401

    payload = request.get_json(silent=True) or {}
    try:
        lodging = add_lodging(trip_id=trip_id, owner_user_id=user["user_id"], payload=payload)
        return jsonify({"message": "lodging created", "lodging": lodging}), 201
    except TripValidationError as error:
        return jsonify({"error": str(error)}), 400
    except TripNotFoundError as error:
        return jsonify({"error": str(error)}), 404
    except TripForbiddenError as error:
        return jsonify({"error": str(error)}), 403
    except Exception as error:
        current_app.logger.exception("Add lodging failed")
        return jsonify({"error": f"add lodging failed: {str(error)}"}), 500


@trips_bp.route("/trips/<int:trip_id>/activities", methods=["POST", "OPTIONS"])
def add_activity_route(trip_id: int):
    if request.method == "OPTIONS":
        return ("", 204)

    user = get_authenticated_user(session)
    if not user:
        return jsonify({"error": "authentication required"}), 401

    payload = request.get_json(silent=True) or {}
    try:
        activity = add_activity(trip_id=trip_id, owner_user_id=user["user_id"], payload=payload)
        return jsonify({"message": "activity created", "activity": activity}), 201
    except TripValidationError as error:
        return jsonify({"error": str(error)}), 400
    except TripNotFoundError as error:
        return jsonify({"error": str(error)}), 404
    except TripForbiddenError as error:
        return jsonify({"error": str(error)}), 403
    except Exception as error:
        current_app.logger.exception("Add activity failed")
        return jsonify({"error": f"add activity failed: {str(error)}"}), 500
