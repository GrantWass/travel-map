from __future__ import annotations

from typing import Any

from flask import Blueprint, jsonify, request
from werkzeug.exceptions import Unauthorized

from services.auth_service import get_authenticated_user
from services.trip_service import (
    TripValidationError,
    add_activity,
    add_lodging,
    add_trip_collaborator,
    create_trip,
    create_trip_comment,
    delete_trip,
    get_trip,
    get_trip_children_by_ids,
    get_trips_by_ids,
    list_non_public_visible_trip_ids,
    list_trip_comments,
    list_trips,
    update_trip,
    update_trip_like_count,
)

trips_bp = Blueprint("trips", __name__)


def _parse_optional_bounding_box(args: dict[str, Any]) -> tuple[float, float, float, float] | None:
    min_lat_raw = args.get("min_lat")
    max_lat_raw = args.get("max_lat")
    min_lng_raw = args.get("min_lng")
    max_lng_raw = args.get("max_lng")

    provided_values = [min_lat_raw, max_lat_raw, min_lng_raw, max_lng_raw]
    if all(value is None for value in provided_values):
        return None

    if any(value is None for value in provided_values):
        raise TripValidationError("min_lat, max_lat, min_lng, and max_lng must all be provided together")

    try:
        min_lat = float(min_lat_raw)
        max_lat = float(max_lat_raw)
        min_lng = float(min_lng_raw)
        max_lng = float(max_lng_raw)
    except (TypeError, ValueError):
        raise TripValidationError("bounding box coordinates must be valid numbers")

    if min_lat < -90 or max_lat > 90:
        raise TripValidationError("latitude bounds must be within [-90, 90]")
    if min_lng < -180 or max_lng > 180:
        raise TripValidationError("longitude bounds must be within [-180, 180]")
    if min_lat > max_lat:
        raise TripValidationError("min_lat must be less than or equal to max_lat")
    if min_lng > max_lng:
        raise TripValidationError("min_lng must be less than or equal to max_lng")

    return (min_lat, max_lat, min_lng, max_lng)


def _parse_trip_ids_arg() -> list[int]:
    trip_ids_raw = request.args.get("ids", "")
    if not trip_ids_raw.strip():
        raise TripValidationError("ids parameter is required")

    trip_ids: list[int] = []
    for id_str in trip_ids_raw.split(","):
        id_str = id_str.strip()
        if not id_str:
            continue
        try:
            trip_ids.append(int(id_str))
        except ValueError:
            raise TripValidationError(f"invalid trip id: {id_str}")

    if not trip_ids:
        raise TripValidationError("ids parameter is required")

    return trip_ids


def _require_authenticated_user() -> dict[str, Any]:
    user = get_authenticated_user()
    if not user:
        raise Unauthorized()
    return user


@trips_bp.route("/trips", methods=["GET"])
def get_trips():
    viewer = get_authenticated_user()
    viewer_user_id = viewer["user_id"] if viewer else None

    bounding_box = _parse_optional_bounding_box(request.args)
    include_children = request.args.get("include_children", "true").lower() in ("true", "1", "yes")
    public_only = request.args.get("public_only", "false").lower() in ("true", "1", "yes")
    trips = list_trips(
        viewer_user_id=viewer_user_id,
        bounding_box=bounding_box,
        include_children=include_children,
        public_only=public_only,
    )
    resp = jsonify({"trips": trips})
    # Cache public-only unauthenticated responses at the CDN/browser for 30 s.
    if public_only and viewer_user_id is None:
        resp.headers["Cache-Control"] = "public, max-age=30, stale-while-revalidate=10"
    return resp, 200


@trips_bp.route("/trips/deferred-ids", methods=["GET"])
def get_deferred_trip_ids():
    viewer = get_authenticated_user()
    viewer_user_id = viewer["user_id"] if viewer else None

    bounding_box = _parse_optional_bounding_box(request.args)
    trip_ids = list_non_public_visible_trip_ids(viewer_user_id=viewer_user_id, bounding_box=bounding_box)
    resp = jsonify({"trip_ids": trip_ids})
    if viewer_user_id is None:
        resp.headers["Cache-Control"] = "public, max-age=30, stale-while-revalidate=10"
    return resp, 200


@trips_bp.route("/trips/batch", methods=["GET"])
def get_trips_batch():
    viewer = get_authenticated_user()
    viewer_user_id = viewer["user_id"] if viewer else None

    trip_ids = _parse_trip_ids_arg()
    trips = get_trips_by_ids(trip_ids, viewer_user_id)
    return jsonify({"trips": trips}), 200


@trips_bp.route("/trips/children-batch", methods=["GET"])
def get_trip_children_batch_route():
    viewer = get_authenticated_user()
    viewer_user_id = viewer["user_id"] if viewer else None

    trip_ids = _parse_trip_ids_arg()
    children = get_trip_children_by_ids(trip_ids, viewer_user_id)
    return jsonify({"children": children}), 200


@trips_bp.route("/trips/<int:trip_id>", methods=["GET"])
def get_trip_by_id(trip_id: int):
    viewer = get_authenticated_user()
    viewer_user_id = viewer["user_id"] if viewer else None

    trip = get_trip(trip_id=trip_id, viewer_user_id=viewer_user_id)
    if not trip:
        return jsonify({"error": "trip not found"}), 404

    return jsonify({"trip": trip}), 200


@trips_bp.route("/trips/<int:trip_id>", methods=["PUT"])
def update_trip_route(trip_id: int):
    user = _require_authenticated_user()

    payload = request.get_json(silent=True) or {}
    trip = update_trip(trip_id=trip_id, owner_user_id=user["user_id"], payload=payload)
    return jsonify({"message": "trip updated", "trip": trip}), 200


@trips_bp.route("/trips/<int:trip_id>", methods=["DELETE"])
def delete_trip_by_id(trip_id: int):
    user = _require_authenticated_user()

    delete_trip(trip_id=trip_id, owner_user_id=user["user_id"])
    return jsonify({"message": "trip deleted"}), 200


@trips_bp.route("/trips", methods=["POST"])
def create_trip_route():
    user = _require_authenticated_user()

    payload = request.get_json(silent=True) or {}
    trip = create_trip(owner_user_id=user["user_id"], payload=payload)
    return jsonify({"message": "trip created", "trip": trip}), 201


@trips_bp.route("/trips/<int:trip_id>/lodgings", methods=["POST"])
def add_lodging_route(trip_id: int):
    user = _require_authenticated_user()

    payload = request.get_json(silent=True) or {}
    lodging = add_lodging(trip_id=trip_id, owner_user_id=user["user_id"], payload=payload)
    return jsonify({"message": "lodging created", "lodging": lodging}), 201


@trips_bp.route("/trips/<int:trip_id>/activities", methods=["POST"])
def add_activity_route(trip_id: int):
    user = _require_authenticated_user()

    payload = request.get_json(silent=True) or {}
    activity = add_activity(trip_id=trip_id, owner_user_id=user["user_id"], payload=payload)
    return jsonify({"message": "activity created", "activity": activity}), 201


@trips_bp.route("/trips/<int:trip_id>/comments", methods=["GET"])
def get_trip_comments_route(trip_id: int):
    viewer = get_authenticated_user()
    viewer_user_id = viewer["user_id"] if viewer else None

    comments = list_trip_comments(trip_id=trip_id, viewer_user_id=viewer_user_id)
    return jsonify({"comments": comments}), 200


@trips_bp.route("/trips/<int:trip_id>/comments", methods=["POST"])
def create_trip_comment_route(trip_id: int):
    user = _require_authenticated_user()

    payload = request.get_json(silent=True) or {}
    comment = create_trip_comment(
        trip_id=trip_id,
        user_id=user["user_id"],
        body=payload.get("body"),
    )
    return jsonify({"message": "comment created", "comment": comment}), 201


@trips_bp.route("/trips/<int:trip_id>/likes", methods=["POST"])
def add_trip_like_route(trip_id: int):
    user = _require_authenticated_user()

    like_count = update_trip_like_count(trip_id=trip_id, viewer_user_id=user["user_id"], delta=1)
    return jsonify({"trip_id": trip_id, "like_count": like_count}), 200


@trips_bp.route("/trips/<int:trip_id>/likes", methods=["DELETE"])
def remove_trip_like_route(trip_id: int):
    user = _require_authenticated_user()

    like_count = update_trip_like_count(trip_id=trip_id, viewer_user_id=user["user_id"], delta=-1)
    return jsonify({"trip_id": trip_id, "like_count": like_count}), 200


@trips_bp.route("/trips/<int:trip_id>/collaborators", methods=["POST"])
def add_trip_collaborator_route(trip_id: int):
    user = _require_authenticated_user()

    payload = request.get_json(silent=True) or {}
    collaborator_user_id_raw = payload.get("collaborator_user_id")
    try:
        collaborator_user_id = int(str(collaborator_user_id_raw))
    except (TypeError, ValueError):
        raise TripValidationError("collaborator_user_id must be a valid integer")

    if collaborator_user_id <= 0:
        raise TripValidationError("collaborator_user_id must be greater than zero")

    result = add_trip_collaborator(
        trip_id=trip_id,
        owner_user_id=user["user_id"],
        collaborator_user_id=collaborator_user_id,
    )
    return jsonify({"message": "collaborator added", **result}), 201
