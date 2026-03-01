from __future__ import annotations

from flask import Blueprint, current_app, jsonify, session

from services.auth_service import get_authenticated_user
from services.plans_service import get_user_plans, toggle_saved_activity, toggle_saved_lodging

plans_bp = Blueprint("plans", __name__)


@plans_bp.route("/users/me/plans", methods=["GET"])
def get_plans():
    user = get_authenticated_user(session)
    if not user:
        return jsonify({"error": "authentication required"}), 401

    try:
        plans = get_user_plans(user["user_id"])
        return jsonify(plans), 200
    except Exception as error:
        current_app.logger.exception("Get plans failed")
        return jsonify({"error": f"get plans failed: {str(error)}"}), 500


@plans_bp.route("/users/me/plans/activities/<int:activity_id>", methods=["POST"])
def toggle_activity(activity_id: int):
    user = get_authenticated_user(session)
    if not user:
        return jsonify({"error": "authentication required"}), 401

    try:
        plans = toggle_saved_activity(user["user_id"], activity_id)
        return jsonify(plans), 200
    except Exception as error:
        current_app.logger.exception("Toggle saved activity failed")
        return jsonify({"error": f"toggle activity failed: {str(error)}"}), 500


@plans_bp.route("/users/me/plans/lodgings/<int:lodge_id>", methods=["POST"])
def toggle_lodging(lodge_id: int):
    user = get_authenticated_user(session)
    if not user:
        return jsonify({"error": "authentication required"}), 401

    try:
        plans = toggle_saved_lodging(user["user_id"], lodge_id)
        return jsonify(plans), 200
    except Exception as error:
        current_app.logger.exception("Toggle saved lodging failed")
        return jsonify({"error": f"toggle lodging failed: {str(error)}"}), 500
