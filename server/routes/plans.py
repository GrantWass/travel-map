from __future__ import annotations

from flask import Blueprint, current_app, jsonify, request

from services.auth_service import get_authenticated_user
from services.plans_service import (
    create_collection,
    delete_collection,
    get_user_plans,
    move_item_to_collection,
    toggle_saved_activity,
    toggle_saved_lodging,
)

plans_bp = Blueprint("plans", __name__)


@plans_bp.route("/users/me/plans", methods=["GET"])
def get_plans():
    user = get_authenticated_user()
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
    user = get_authenticated_user()
    if not user:
        return jsonify({"error": "authentication required"}), 401

    try:
        body = request.get_json(silent=True) or {}
        collection_name = body.get("collection_name") or None
        plans = toggle_saved_activity(user["user_id"], activity_id, collection_name)
        return jsonify(plans), 200
    except Exception as error:
        current_app.logger.exception("Toggle saved activity failed")
        return jsonify({"error": f"toggle activity failed: {str(error)}"}), 500


@plans_bp.route("/users/me/plans/lodgings/<int:lodge_id>", methods=["POST"])
def toggle_lodging(lodge_id: int):
    user = get_authenticated_user()
    if not user:
        return jsonify({"error": "authentication required"}), 401

    try:
        body = request.get_json(silent=True) or {}
        collection_name = body.get("collection_name") or None
        plans = toggle_saved_lodging(user["user_id"], lodge_id, collection_name)
        return jsonify(plans), 200
    except Exception as error:
        current_app.logger.exception("Toggle saved lodging failed")
        return jsonify({"error": f"toggle lodging failed: {str(error)}"}), 500


@plans_bp.route("/users/me/plans/collections", methods=["POST"])
def add_collection():
    user = get_authenticated_user()
    if not user:
        return jsonify({"error": "authentication required"}), 401

    try:
        body = request.get_json(silent=True) or {}
        name = (body.get("name") or "").strip()
        if not name:
            return jsonify({"error": "Collection name is required."}), 400

        plans = create_collection(user["user_id"], name)
        return jsonify(plans), 200
    except ValueError as error:
        return jsonify({"error": str(error)}), 400
    except Exception as error:
        current_app.logger.exception("Create collection failed")
        return jsonify({"error": f"create collection failed: {str(error)}"}), 500


@plans_bp.route("/users/me/plans/collections/<string:name>", methods=["DELETE"])
def remove_collection(name: str):
    user = get_authenticated_user()
    if not user:
        return jsonify({"error": "authentication required"}), 401

    try:
        plans = delete_collection(user["user_id"], name)
        return jsonify(plans), 200
    except Exception as error:
        current_app.logger.exception("Delete collection failed")
        return jsonify({"error": f"delete collection failed: {str(error)}"}), 500


@plans_bp.route("/users/me/plans/activities/<int:activity_id>/collection", methods=["PATCH"])
def move_activity_collection(activity_id: int):
    user = get_authenticated_user()
    if not user:
        return jsonify({"error": "authentication required"}), 401

    try:
        body = request.get_json(silent=True) or {}
        collection_name = body.get("collection_name") or None
        plans = move_item_to_collection(user["user_id"], "activity", activity_id, collection_name)
        return jsonify(plans), 200
    except Exception as error:
        current_app.logger.exception("Move activity to collection failed")
        return jsonify({"error": f"move item failed: {str(error)}"}), 500


@plans_bp.route("/users/me/plans/lodgings/<int:lodge_id>/collection", methods=["PATCH"])
def move_lodging_collection(lodge_id: int):
    user = get_authenticated_user()
    if not user:
        return jsonify({"error": "authentication required"}), 401

    try:
        body = request.get_json(silent=True) or {}
        collection_name = body.get("collection_name") or None
        plans = move_item_to_collection(user["user_id"], "lodging", lodge_id, collection_name)
        return jsonify(plans), 200
    except Exception as error:
        current_app.logger.exception("Move lodging to collection failed")
        return jsonify({"error": f"move item failed: {str(error)}"}), 500
