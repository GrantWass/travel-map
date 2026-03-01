from __future__ import annotations

from flask import Blueprint, current_app, jsonify, request, session

from services.auth_service import get_authenticated_user, to_nullable_string, update_profile
from services.trip_service import get_user_profile, list_user_trips

profile_bp = Blueprint("profile", __name__)


@profile_bp.route("/profile/setup", methods=["POST", "OPTIONS"])
def profile_setup():
    if request.method == "OPTIONS":
        return ("", 204)

    user = get_authenticated_user(session)
    if not user:
        return jsonify({"error": "authentication required"}), 401

    try:
        payload = request.get_json(silent=True) or {}
        account_type = to_nullable_string(payload.get("account_type")) or "traveler"
        if account_type not in {"student", "traveler"}:
            return jsonify({"error": "account_type must be student or traveler"}), 400

        bio = to_nullable_string(payload.get("bio"))
        college = to_nullable_string(payload.get("college"))
        profile_image_url = to_nullable_string(payload.get("profile_image_url"))
        verified = account_type == "student"

        updated_user = update_profile(
            user_id=user["user_id"],
            bio=bio,
            college=college,
            profile_image_url=profile_image_url,
            verified=verified,
        )

        return jsonify({"message": "profile updated", "user": updated_user}), 200
    except Exception as error:
        current_app.logger.exception("Profile setup failed")
        return jsonify({"error": f"profile setup failed: {str(error)}"}), 500


@profile_bp.route("/users/me/trips", methods=["GET", "OPTIONS"])
def my_trips():
    if request.method == "OPTIONS":
        return ("", 204)

    user = get_authenticated_user(session)
    if not user:
        return jsonify({"error": "authentication required"}), 401

    trips = list_user_trips(target_user_id=user["user_id"], viewer_user_id=user["user_id"])
    return jsonify({"trips": trips}), 200


@profile_bp.route("/users/<int:user_id>/profile", methods=["GET", "OPTIONS"])
def user_profile(user_id: int):
    if request.method == "OPTIONS":
        return ("", 204)

    viewer = get_authenticated_user(session)
    viewer_user_id = viewer["user_id"] if viewer else None

    try:
        profile = get_user_profile(user_id=user_id, viewer_user_id=viewer_user_id)
        if not profile:
            return jsonify({"error": "user not found"}), 404

        return jsonify(profile), 200
    except Exception as error:
        current_app.logger.exception("User profile lookup failed")
        return jsonify({"error": f"user profile lookup failed: {str(error)}"}), 500
