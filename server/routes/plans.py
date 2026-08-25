from __future__ import annotations

from typing import Any

from flask import Blueprint, jsonify, request

from services.auth_service import get_authenticated_user, to_nullable_string
from services.plans_service import (
    PlanNotFoundError,
    add_custom_item,
    create_collection,
    create_plan_share,
    delete_collection,
    delete_custom_item,
    get_shared_plan,
    get_user_plans,
    move_custom_item_to_collection,
    move_item_to_collection,
    toggle_saved_activity,
    toggle_saved_lodging,
    update_custom_item,
)

plans_bp = Blueprint("plans", __name__)


def _to_optional_float(value: Any) -> float | None:
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _require_authenticated_user():
    user = get_authenticated_user()
    if not user:
        from werkzeug.exceptions import Unauthorized

        raise Unauthorized()
    return user


@plans_bp.route("/users/me/plans", methods=["GET"])
def get_plans():
    user = _require_authenticated_user()

    plans = get_user_plans(user["user_id"])
    return jsonify(plans), 200


@plans_bp.route("/users/me/plans/activities/<int:activity_id>", methods=["POST"])
def toggle_activity(activity_id: int):
    user = _require_authenticated_user()

    body = request.get_json(silent=True) or {}
    collection_name = body.get("collection_name") or None
    plans = toggle_saved_activity(user["user_id"], activity_id, collection_name)
    return jsonify(plans), 200


@plans_bp.route("/users/me/plans/lodgings/<int:lodge_id>", methods=["POST"])
def toggle_lodging(lodge_id: int):
    user = _require_authenticated_user()

    body = request.get_json(silent=True) or {}
    collection_name = body.get("collection_name") or None
    plans = toggle_saved_lodging(user["user_id"], lodge_id, collection_name)
    return jsonify(plans), 200


@plans_bp.route("/users/me/plans/collections", methods=["POST"])
def add_collection():
    user = _require_authenticated_user()

    body = request.get_json(silent=True) or {}
    name = (body.get("name") or "").strip()
    if not name:
        return jsonify({"error": "Collection name is required."}), 400

    plans = create_collection(user["user_id"], name)
    return jsonify(plans), 200


@plans_bp.route("/users/me/plans/collections/<string:name>", methods=["DELETE"])
def remove_collection(name: str):
    user = _require_authenticated_user()

    plans = delete_collection(user["user_id"], name)
    return jsonify(plans), 200


@plans_bp.route("/users/me/plans/activities/<int:activity_id>/collection", methods=["PATCH"])
def move_activity_collection(activity_id: int):
    user = _require_authenticated_user()

    body = request.get_json(silent=True) or {}
    collection_name = body.get("collection_name") or None
    plans = move_item_to_collection(user["user_id"], "activity", activity_id, collection_name)
    return jsonify(plans), 200


@plans_bp.route("/users/me/plans/lodgings/<int:lodge_id>/collection", methods=["PATCH"])
def move_lodging_collection(lodge_id: int):
    user = _require_authenticated_user()

    body = request.get_json(silent=True) or {}
    collection_name = body.get("collection_name") or None
    plans = move_item_to_collection(user["user_id"], "lodging", lodge_id, collection_name)
    return jsonify(plans), 200


@plans_bp.route("/users/me/plans/custom-items", methods=["POST"])
def add_custom_plan_item():
    user = _require_authenticated_user()

    body = request.get_json(silent=True) or {}
    title = to_nullable_string(body.get("title"))
    if not title:
        return jsonify({"error": "title is required"}), 400

    link_url = to_nullable_string(body.get("link_url"))
    if link_url and not link_url.lower().startswith(("http://", "https://")):
        return jsonify({"error": "link must start with http:// or https://"}), 400

    plans = add_custom_item(
        user["user_id"],
        title=title,
        notes=to_nullable_string(body.get("notes")),
        address=to_nullable_string(body.get("address")),
        cost=to_nullable_string(body.get("cost")),
        link_url=link_url,
        collection_name=to_nullable_string(body.get("collection_name")) or None,
        item_type=str(body.get("item_type") or "activity"),
        description=to_nullable_string(body.get("description")),
        latitude=_to_optional_float(body.get("latitude")),
        longitude=_to_optional_float(body.get("longitude")),
        thumbnail_url=to_nullable_string(body.get("thumbnail_url")),
    )
    return jsonify(plans), 201


@plans_bp.route("/users/me/plans/custom-items/<int:custom_item_id>", methods=["PUT"])
def update_custom_plan_item(custom_item_id: int):
    user = _require_authenticated_user()

    body = request.get_json(silent=True) or {}
    if "link_url" in body:
        link_url = to_nullable_string(body.get("link_url"))
        if link_url and not link_url.lower().startswith(("http://", "https://")):
            return jsonify({"error": "link must start with http:// or https://"}), 400
    try:
        plans = update_custom_item(user["user_id"], custom_item_id, body)
    except PlanNotFoundError as error:
        return jsonify({"error": str(error)}), 404
    except ValueError as error:
        return jsonify({"error": str(error)}), 400
    return jsonify(plans), 200


@plans_bp.route("/users/me/plans/custom-items/<int:custom_item_id>", methods=["DELETE"])
def delete_custom_plan_item(custom_item_id: int):
    user = _require_authenticated_user()

    try:
        plans = delete_custom_item(user["user_id"], custom_item_id)
    except PlanNotFoundError as error:
        return jsonify({"error": str(error)}), 404
    return jsonify(plans), 200


@plans_bp.route("/users/me/plans/custom-items/<int:custom_item_id>/collection", methods=["PATCH"])
def move_custom_plan_item_collection(custom_item_id: int):
    user = _require_authenticated_user()

    body = request.get_json(silent=True) or {}
    collection_name = to_nullable_string(body.get("collection_name")) or None
    try:
        plans = move_custom_item_to_collection(user["user_id"], custom_item_id, collection_name)
    except PlanNotFoundError as error:
        return jsonify({"error": str(error)}), 404
    return jsonify(plans), 200


@plans_bp.route("/users/me/plans/share", methods=["POST"])
def share_plans():
    user = _require_authenticated_user()

    body = request.get_json(silent=True) or {}
    result = create_plan_share(
        user["user_id"],
        to_nullable_string(body.get("collection_name")) or None,
    )
    return jsonify(result), 201


# Public, unauthenticated read-only view of a shared plan.
@plans_bp.route("/plans/shared/<string:share_token>", methods=["GET"])
def get_plan_share(share_token: str):
    shared = get_shared_plan(share_token)
    if not shared:
        return jsonify({"error": "share link not found"}), 404
    return jsonify(shared), 200
