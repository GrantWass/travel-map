from __future__ import annotations

from flask import Blueprint, current_app, jsonify, request

from services.auth_service import UNSET, get_authenticated_user, mark_onboarding_steps_complete, to_nullable_string, update_profile, update_user_settings
from services.trip_service import get_user_profile, list_user_trips
from services.auth_service import search_users as svc_search_users
from services.sms_service import create_sms_invite as svc_create_sms_invite, claim_sms_invite as svc_claim_sms_invite
from services.friendship_service import create_friend_request as svc_create_friend_request, respond_friend_request as svc_respond_friend_request
from services.friendship_service import list_friendships as svc_list_friendships

profile_bp = Blueprint("profile", __name__)


@profile_bp.route("/profile/setup", methods=["POST", "OPTIONS"])
def profile_setup():
    if request.method == "OPTIONS":
        return ("", 204)

    user = get_authenticated_user()
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

    user = get_authenticated_user()
    if not user:
        return jsonify({"error": "authentication required"}), 401

    trips = list_user_trips(target_user_id=user["user_id"], viewer_user_id=user["user_id"])
    return jsonify({"trips": trips}), 200


@profile_bp.route("/users/<int:user_id>/profile", methods=["GET", "OPTIONS"])
def user_profile(user_id: int):
    if request.method == "OPTIONS":
        return ("", 204)

    viewer = get_authenticated_user()
    viewer_user_id = viewer["user_id"] if viewer else None

    try:
        profile = get_user_profile(user_id=user_id, viewer_user_id=viewer_user_id)
        if not profile:
            return jsonify({"error": "user not found"}), 404

        return jsonify(profile), 200
    except Exception as error:
        current_app.logger.exception("User profile lookup failed")
        return jsonify({"error": f"user profile lookup failed: {str(error)}"}), 500


@profile_bp.route("/users/me/onboarding", methods=["PATCH", "OPTIONS"])
def mark_onboarding():
    if request.method == "OPTIONS":
        return ("", 204)

    user = get_authenticated_user()
    if not user:
        return jsonify({"error": "authentication required"}), 401

    try:
        payload = request.get_json(silent=True) or {}
        step_ids = payload.get("completed_step_ids")
        if not isinstance(step_ids, list):
            return jsonify({"error": "completed_step_ids must be a list"}), 400

        valid_ids = [s for s in step_ids if isinstance(s, str) and s.strip()]
        updated_user = mark_onboarding_steps_complete(user_id=user["user_id"], step_ids=valid_ids)
        return jsonify({"message": "onboarding updated", "user": updated_user}), 200
    except Exception as error:
        current_app.logger.exception("Onboarding update failed")
        return jsonify({"error": f"onboarding update failed: {str(error)}"}), 500


@profile_bp.route("/profile/update", methods=["POST", "OPTIONS"])
def update_profile_settings():
    if request.method == "OPTIONS":
        return ("", 204)

    user = get_authenticated_user()
    if not user:
        return jsonify({"error": "authentication required"}), 401

    try:
        payload = request.get_json(silent=True) or {}
        if not isinstance(payload, dict):
            return jsonify({"error": "request body must be a JSON object"}), 400

        name: str | None | object = UNSET
        if "name" in payload:
            parsed_name = to_nullable_string(payload.get("name"))
            if not parsed_name:
                return jsonify({"error": "name is required"}), 400
            name = parsed_name

        bio: str | None | object = UNSET
        if "bio" in payload:
            bio = to_nullable_string(payload.get("bio"))

        college: str | None | object = UNSET
        if "college" in payload:
            parsed_college = to_nullable_string(payload.get("college"))
            if not parsed_college:
                return jsonify({"error": "college is required"}), 400

            if to_nullable_string(user.get("college")):
                return jsonify({"error": "college is already set"}), 400
            college = parsed_college

        profile_image_url: str | None | object = UNSET
        if "profile_image_url" in payload:
            parsed_profile_image_url = to_nullable_string(payload.get("profile_image_url"))
            if not parsed_profile_image_url:
                return jsonify({"error": "profile_image_url is required"}), 400
            profile_image_url = parsed_profile_image_url

        if name is UNSET and bio is UNSET and college is UNSET and profile_image_url is UNSET:
            return jsonify({"error": "no profile updates provided"}), 400

        updated_user = update_user_settings(
            user_id=user["user_id"],
            name=name,
            bio=bio,
            college=college,
            profile_image_url=profile_image_url,
        )
        if not updated_user:
            return jsonify({"error": "user not found"}), 404

        return jsonify({"message": "profile updated", "user": updated_user}), 200
    except Exception as error:
        current_app.logger.exception("Profile update failed")
        return jsonify({"error": f"profile update failed: {str(error)}"}), 500


@profile_bp.route("/sms-invites", methods=["POST", "OPTIONS"])
def create_sms_invite():
    if request.method == "OPTIONS":
        return ("", 204)

    user = get_authenticated_user()
    if not user:
        return jsonify({"error": "authentication required"}), 401

    try:
        payload = request.get_json(silent=True) or {}
        phone_number = to_nullable_string(payload.get("phone_number"))
        if not phone_number:
            return jsonify({"error": "phone_number is required"}), 400

        invite = svc_create_sms_invite(inviter_id=user["user_id"], phone_number=phone_number)
        return jsonify({"message": "invite created", "invite": invite}), 201
    except Exception as error:
        current_app.logger.exception("Create sms invite failed")
        return jsonify({"error": f"create sms invite failed: {str(error)}"}), 500


@profile_bp.route("/sms-invites/claim", methods=["POST", "OPTIONS"])
def claim_sms_invite():
    if request.method == "OPTIONS":
        return ("", 204)

    user = get_authenticated_user()
    if not user:
        return jsonify({"error": "authentication required"}), 401

    try:
        payload = request.get_json(silent=True) or {}
        invite_token = to_nullable_string(payload.get("invite_token"))
        if not invite_token:
            return jsonify({"error": "invite_token is required"}), 400

        claimed = svc_claim_sms_invite(invite_token=invite_token, claimed_user_id=user["user_id"])
        if not claimed:
            return jsonify({"error": "invite not found or already claimed"}), 404

        return jsonify({"message": "invite claimed", "invite": claimed}), 200
    except Exception as error:
        current_app.logger.exception("Claim sms invite failed")
        return jsonify({"error": f"claim sms invite failed: {str(error)}"}), 500


@profile_bp.route("/friendships", methods=["POST", "OPTIONS"])
def create_friendship():
    if request.method == "OPTIONS":
        return ("", 204)

    user = get_authenticated_user()
    if not user:
        return jsonify({"error": "authentication required"}), 401

    try:
        payload = request.get_json(silent=True) or {}
        addressee_id = payload.get("addressee_id")
        try:
            addressee_id = int(addressee_id)
        except Exception:
            return jsonify({"error": "addressee_id must be an integer"}), 400

        friendship = svc_create_friend_request(requester_id=user["user_id"], addressee_id=addressee_id)
        if not friendship:
            return jsonify({"error": "invalid friend request"}), 400

        return jsonify({"message": "friend request created", "friendship": friendship}), 201
    except Exception as error:
        current_app.logger.exception("Create friendship failed")
        return jsonify({"error": f"create friendship failed: {str(error)}"}), 500


@profile_bp.route("/friendships", methods=["GET", "OPTIONS"])
def list_friendships():
    if request.method == "OPTIONS":
        return ("", 204)

    user = get_authenticated_user()
    if not user:
        return jsonify({"error": "authentication required"}), 401

    try:
        data = svc_list_friendships(user_id=user["user_id"])
        return jsonify(data), 200
    except Exception as error:
        current_app.logger.exception("List friendships failed")
        return jsonify({"error": f"list friendships failed: {str(error)}"}), 500


@profile_bp.route("/users/search", methods=["GET", "OPTIONS"])
def search_users():
    if request.method == "OPTIONS":
        return ("", 204)

    q = (request.args.get("q") or "").strip()
    try:
        users = svc_search_users(q)
        return jsonify({"users": users}), 200
    except Exception as error:
        current_app.logger.exception("User search failed")
        return jsonify({"error": f"user search failed: {str(error)}"}), 500


@profile_bp.route("/friendships/<int:friendship_id>/respond", methods=["POST", "OPTIONS"])
def respond_friendship(friendship_id: int):
    if request.method == "OPTIONS":
        return ("", 204)

    user = get_authenticated_user()
    if not user:
        return jsonify({"error": "authentication required"}), 401

    try:
        payload = request.get_json(silent=True) or {}
        status = to_nullable_string(payload.get("status"))
        if status not in {"accepted", "declined", "pending"}:
            return jsonify({"error": "status must be 'accepted', 'declined', or 'pending'"}), 400

        updated = svc_respond_friend_request(friendship_id=friendship_id, responder_id=user["user_id"], status=status)
        if not updated:
            return jsonify({"error": "friendship not found or unauthorized"}), 404

        return jsonify({"message": "friendship updated", "friendship": updated}), 200
    except Exception as error:
        current_app.logger.exception("Respond to friendship failed")
        return jsonify({"error": f"respond failed: {str(error)}"}), 500
