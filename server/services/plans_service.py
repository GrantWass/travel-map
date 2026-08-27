from __future__ import annotations

import hashlib
import secrets
from typing import Any

import psycopg2
from psycopg2.extras import Json
from db import get_cursor


class PlanNotFoundError(LookupError):
    pass


def _as_optional_float(value: Any) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _parse_item_type(value: Any) -> str:
    item_type = str(value or "activity").strip().lower()
    if item_type not in ("activity", "lodging"):
        raise ValueError("item_type must be 'activity' or 'lodging'")
    return item_type


def _build_plans_response(user_id: int) -> dict[str, Any]:
    with get_cursor() as cur:
        cur.execute(
            """
            SELECT item_type, item_id, collection_name
            FROM saved_plan_items
            WHERE user_id = %s
            ORDER BY saved_at DESC
            """,
            (user_id,),
        )
        rows = cur.fetchall()

        cur.execute(
            """
            SELECT custom_item_id, title, notes, address, cost, collection_name, link_url,
                   item_type, description, latitude, longitude, thumbnail_url
            FROM plan_custom_items
            WHERE owner_user_id = %s
            ORDER BY created_at DESC, custom_item_id DESC
            """,
            (user_id,),
        )
        custom_rows = cur.fetchall()

        try:
            cur.execute(
                """
                SELECT flight_id, airline, flight_number, origin_code, destination_code,
                       departure_date, outbound_date, return_date, outbound_legs, return_legs,
                       departure_time, price, price_minor, currency, collection_name, link_url, notes
                FROM plan_flights
                WHERE owner_user_id = %s
                ORDER BY created_at DESC, flight_id DESC
                """,
                (user_id,),
            )
            flight_rows = cur.fetchall()
        except psycopg2.errors.UndefinedTable:
            # Migration not applied yet — treat flights as empty rather than
            # failing every plans operation.
            cur.connection.rollback()
            flight_rows = []

    real_rows = [r for r in rows if r["item_type"] != "collection_anchor"]
    anchor_rows = [r for r in rows if r["item_type"] == "collection_anchor"]

    saved_items = [
        {
            "item_type": row["item_type"],
            "item_id": row["item_id"],
            "collection_name": row["collection_name"],
        }
        for row in real_rows
    ]

    saved_activity_ids = [r["item_id"] for r in real_rows if r["item_type"] == "activity"]
    saved_lodging_ids = [r["item_id"] for r in real_rows if r["item_type"] == "lodging"]

    custom_items = [
        {
            "custom_item_id": int(r["custom_item_id"]),
            "title": r.get("title"),
            "notes": r.get("notes"),
            "address": r.get("address"),
            "cost": r.get("cost"),
            "collection_name": r.get("collection_name"),
            "link_url": r.get("link_url"),
            "item_type": r.get("item_type") or "activity",
            "description": r.get("description"),
            "latitude": _as_optional_float(r.get("latitude")),
            "longitude": _as_optional_float(r.get("longitude")),
            "thumbnail_url": r.get("thumbnail_url"),
        }
        for r in custom_rows
    ]

    collection_names_from_items = {r["collection_name"] for r in real_rows if r["collection_name"]}
    collection_names_from_anchors = {r["collection_name"] for r in anchor_rows if r["collection_name"]}
    collection_names_from_custom = {r["collection_name"] for r in custom_rows if r["collection_name"]}
    collection_names_from_flights = {r["collection_name"] for r in flight_rows if r["collection_name"]}
    collections = sorted(
        collection_names_from_items
        | collection_names_from_anchors
        | collection_names_from_custom
        | collection_names_from_flights
    )

    flights = [
        {
            "flight_id": int(r["flight_id"]),
            "airline": r.get("airline"),
            "flight_number": r.get("flight_number"),
            "origin_code": r.get("origin_code"),
            "destination_code": r.get("destination_code"),
            "departure_date": r.get("departure_date"),
            "outbound_date": r.get("outbound_date") or r.get("departure_date"),
            "return_date": r.get("return_date"),
            "outbound_legs": r.get("outbound_legs") or [],
            "return_legs": r.get("return_legs") or [],
            "departure_time": r.get("departure_time"),
            "price": r.get("price"),
            "price_minor": r.get("price_minor"),
            "currency": r.get("currency"),
            "collection_name": r.get("collection_name"),
            "link_url": r.get("link_url"),
            "notes": r.get("notes"),
        }
        for r in flight_rows
    ]

    return {
        "saved_activity_ids": saved_activity_ids,
        "saved_lodging_ids": saved_lodging_ids,
        "saved_items": saved_items,
        "custom_items": custom_items,
        "flights": flights,
        "collections": collections,
    }


def get_user_plans(user_id: int) -> dict[str, Any]:
    return _build_plans_response(user_id)


def toggle_saved_activity(
    user_id: int, activity_id: int, collection_name: str | None = None
) -> dict[str, Any]:
    with get_cursor(commit=True) as cur:
        cur.execute(
            "SELECT id FROM saved_plan_items WHERE user_id = %s AND item_type = 'activity' AND item_id = %s",
            (user_id, activity_id),
        )
        existing = cur.fetchone()

        if existing:
            cur.execute(
                "DELETE FROM saved_plan_items WHERE user_id = %s AND item_type = 'activity' AND item_id = %s",
                (user_id, activity_id),
            )
        else:
            cur.execute(
                """
                INSERT INTO saved_plan_items (user_id, item_type, item_id, collection_name)
                VALUES (%s, 'activity', %s, %s)
                ON CONFLICT (user_id, item_type, item_id)
                DO UPDATE SET collection_name = EXCLUDED.collection_name
                """,
                (user_id, activity_id, collection_name),
            )

    return _build_plans_response(user_id)


def toggle_saved_lodging(
    user_id: int, lodge_id: int, collection_name: str | None = None
) -> dict[str, Any]:
    with get_cursor(commit=True) as cur:
        cur.execute(
            "SELECT id FROM saved_plan_items WHERE user_id = %s AND item_type = 'lodging' AND item_id = %s",
            (user_id, lodge_id),
        )
        existing = cur.fetchone()

        if existing:
            cur.execute(
                "DELETE FROM saved_plan_items WHERE user_id = %s AND item_type = 'lodging' AND item_id = %s",
                (user_id, lodge_id),
            )
        else:
            cur.execute(
                """
                INSERT INTO saved_plan_items (user_id, item_type, item_id, collection_name)
                VALUES (%s, 'lodging', %s, %s)
                ON CONFLICT (user_id, item_type, item_id)
                DO UPDATE SET collection_name = EXCLUDED.collection_name
                """,
                (user_id, lodge_id, collection_name),
            )

    return _build_plans_response(user_id)


def create_collection(user_id: int, name: str) -> dict[str, Any]:
    """
    Persist an empty collection via an anchor row so it survives having no items.
    Uses a synthetic item_type 'collection_anchor' with item_id=0.
    The UNIQUE constraint is (user_id, item_type, item_id) so each user can have
    one anchor per collection name (stored in collection_name on the anchor row,
    but we differentiate anchors from real items via item_type).
    We encode the collection name in collection_name and use a stable item_id
    derived from the name hash to satisfy the unique constraint.
    """
    name = name.strip()
    if not name:
        raise ValueError("Collection name cannot be empty.")

    # Use a stable item_id so we can ON CONFLICT safely.
    # hash() is consistent within a process but not across — use a deterministic hash.
    import hashlib
    anchor_id = int(hashlib.md5(name.encode()).hexdigest(), 16) % (2**31)

    with get_cursor(commit=True) as cur:
        cur.execute(
            """
            INSERT INTO saved_plan_items (user_id, item_type, item_id, collection_name)
            VALUES (%s, 'collection_anchor', %s, %s)
            ON CONFLICT (user_id, item_type, item_id) DO NOTHING
            """,
            (user_id, anchor_id, name),
        )

    return _build_plans_response(user_id)


def delete_collection(user_id: int, name: str) -> dict[str, Any]:
    """Deletes a collection. Items become uncollected (collection_name = NULL)."""
    with get_cursor(commit=True) as cur:
        cur.execute(
            """
            UPDATE saved_plan_items
            SET collection_name = NULL
            WHERE user_id = %s AND collection_name = %s AND item_type != 'collection_anchor'
            """,
            (user_id, name),
        )
        cur.execute(
            """
            DELETE FROM saved_plan_items
            WHERE user_id = %s AND item_type = 'collection_anchor' AND collection_name = %s
            """,
            (user_id, name),
        )
        cur.execute(
            """
            UPDATE plan_custom_items
            SET collection_name = NULL
            WHERE owner_user_id = %s AND collection_name = %s
            """,
            (user_id, name),
        )
        cur.execute(
            """
            UPDATE plan_flights
            SET collection_name = NULL
            WHERE owner_user_id = %s AND collection_name = %s
            """,
            (user_id, name),
        )

    return _build_plans_response(user_id)


def move_item_to_collection(
    user_id: int, item_type: str, item_id: int, collection_name: str | None
) -> dict[str, Any]:
    """Assign a saved item to a different collection (or remove from any collection)."""
    with get_cursor(commit=True) as cur:
        cur.execute(
            """
            UPDATE saved_plan_items
            SET collection_name = %s
            WHERE user_id = %s AND item_type = %s AND item_id = %s
            """,
            (collection_name, user_id, item_type, item_id),
        )

    return _build_plans_response(user_id)


# ── Custom (user-authored) plan items ────────────────────────────────────────

def add_custom_item(
    user_id: int,
    *,
    title: str,
    notes: str | None = None,
    address: str | None = None,
    cost: str | None = None,
    link_url: str | None = None,
    collection_name: str | None = None,
    item_type: str = "activity",
    description: str | None = None,
    latitude: float | None = None,
    longitude: float | None = None,
    thumbnail_url: str | None = None,
) -> dict[str, Any]:
    title = title.strip()
    if not title:
        raise ValueError("title is required")
    parsed_item_type = _parse_item_type(item_type)

    with get_cursor(commit=True) as cur:
        cur.execute(
            """
            INSERT INTO plan_custom_items
                (owner_user_id, title, notes, address, cost, link_url, collection_name,
                 item_type, description, latitude, longitude, thumbnail_url)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING custom_item_id
            """,
            (
                user_id,
                title,
                notes,
                address,
                cost,
                link_url,
                collection_name,
                parsed_item_type,
                description,
                latitude,
                longitude,
                thumbnail_url,
            ),
        )
        row = cur.fetchone()

    if not row:
        raise ValueError("failed to create plan item")

    response = _build_plans_response(user_id)
    # Include the new item id so clients can reference it immediately.
    response["created_custom_item_id"] = int(row["custom_item_id"])
    return response


def update_custom_item(user_id: int, custom_item_id: int, fields: dict[str, Any]) -> dict[str, Any]:
    allowed = {"title", "notes", "address", "cost", "link_url", "item_type", "description", "latitude", "longitude", "thumbnail_url"}
    updates = {key: value for key, value in fields.items() if key in allowed}
    if "title" in updates and not str(updates["title"]).strip():
        raise ValueError("title is required")
    if "item_type" in updates:
        updates["item_type"] = _parse_item_type(updates["item_type"])
    if not updates:
        return _build_plans_response(user_id)

    set_clause = ", ".join(f"{key} = %s" for key in updates)
    params = list(updates.values()) + [user_id, custom_item_id]

    with get_cursor(commit=True) as cur:
        cur.execute(
            f"""
            UPDATE plan_custom_items
            SET {set_clause}
            WHERE owner_user_id = %s AND custom_item_id = %s
            """,
            params,
        )
        if cur.rowcount < 1:
            raise PlanNotFoundError("plan item not found")

    return _build_plans_response(user_id)


def delete_custom_item(user_id: int, custom_item_id: int) -> dict[str, Any]:
    with get_cursor(commit=True) as cur:
        cur.execute(
            "DELETE FROM plan_custom_items WHERE owner_user_id = %s AND custom_item_id = %s",
            (user_id, custom_item_id),
        )
        if cur.rowcount < 1:
            raise PlanNotFoundError("plan item not found")

    return _build_plans_response(user_id)


def move_custom_item_to_collection(
    user_id: int, custom_item_id: int, collection_name: str | None
) -> dict[str, Any]:
    with get_cursor(commit=True) as cur:
        cur.execute(
            """
            UPDATE plan_custom_items
            SET collection_name = %s
            WHERE owner_user_id = %s AND custom_item_id = %s
            """,
            (collection_name, user_id, custom_item_id),
        )
        if cur.rowcount < 1:
            raise PlanNotFoundError("plan item not found")

    return _build_plans_response(user_id)


# ── Flights ──────────────────────────────────────────────────────────────────

_FLIGHT_FIELDS = (
    "airline",
    "flight_number",
    "origin_code",
    "destination_code",
    "departure_date",
    "outbound_date",
    "return_date",
    "departure_time",
    "price",
    "currency",
)
_FLIGHT_JSON_FIELDS = ("outbound_legs", "return_legs")


def add_flight(
    user_id: int,
    *,
    collection_name: str | None = None,
    link_url: str | None = None,
    notes: str | None = None,
    **fields: Any,
) -> dict[str, Any]:
    values = {key: (str(fields[key]).strip() or None) if fields.get(key) else None for key in _FLIGHT_FIELDS}
    legs = {key: fields.get(key) if isinstance(fields.get(key), list) else [] for key in _FLIGHT_JSON_FIELDS}
    price_minor = fields.get("price_minor") if isinstance(fields.get("price_minor"), int) else None
    if link_url and not str(link_url).lower().startswith(("http://", "https://")):
        raise ValueError("link must start with http:// or https://")

    if not any(values.values()) and not notes:
        raise ValueError("add at least one flight detail")

    with get_cursor(commit=True) as cur:
        cur.execute(
            """
            INSERT INTO plan_flights
                (owner_user_id, collection_name, airline, flight_number, origin_code,
                 destination_code, departure_date, outbound_date, return_date, outbound_legs,
                 return_legs, departure_time, price, price_minor, currency, link_url, notes)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING flight_id
            """,
            (
                user_id,
                collection_name,
                values["airline"],
                values["flight_number"],
                values["origin_code"],
                values["destination_code"],
                values["departure_date"],
                values["outbound_date"] or values["departure_date"],
                values["return_date"],
                Json(legs["outbound_legs"]),
                Json(legs["return_legs"]),
                values["departure_time"],
                values["price"],
                price_minor,
                values["currency"],
                link_url,
                notes,
            ),
        )
        row = cur.fetchone()

    if not row:
        raise ValueError("failed to create flight")

    response = _build_plans_response(user_id)
    response["created_flight_id"] = int(row["flight_id"])
    return response


def update_flight(user_id: int, flight_id: int, fields: dict[str, Any]) -> dict[str, Any]:
    allowed = set(_FLIGHT_FIELDS) | set(_FLIGHT_JSON_FIELDS) | {"price_minor", "notes", "link_url"}
    updates = {key: value for key, value in fields.items() if key in allowed}
    if not updates:
        return _build_plans_response(user_id)

    set_clause = ", ".join(f"{key} = %s" for key in updates)
    params = [Json(value) if key in _FLIGHT_JSON_FIELDS else value for key, value in updates.items()] + [user_id, flight_id]

    with get_cursor(commit=True) as cur:
        cur.execute(
            f"""
            UPDATE plan_flights
            SET {set_clause}
            WHERE owner_user_id = %s AND flight_id = %s
            """,
            params,
        )
        if cur.rowcount < 1:
            raise PlanNotFoundError("flight not found")

    return _build_plans_response(user_id)


def delete_flight(user_id: int, flight_id: int) -> dict[str, Any]:
    with get_cursor(commit=True) as cur:
        cur.execute(
            "DELETE FROM plan_flights WHERE owner_user_id = %s AND flight_id = %s",
            (user_id, flight_id),
        )
        if cur.rowcount < 1:
            raise PlanNotFoundError("flight not found")

    return _build_plans_response(user_id)


def move_flight_to_collection(
    user_id: int, flight_id: int, collection_name: str | None
) -> dict[str, Any]:
    with get_cursor(commit=True) as cur:
        cur.execute(
            """
            UPDATE plan_flights
            SET collection_name = %s
            WHERE owner_user_id = %s AND flight_id = %s
            """,
            (collection_name, user_id, flight_id),
        )
        if cur.rowcount < 1:
            raise PlanNotFoundError("flight not found")

    return _build_plans_response(user_id)


# ── Share links ──────────────────────────────────────────────────────────────

def create_plan_share(user_id: int, collection_name: str | None) -> dict[str, Any]:
    """Create a read-only share link for one collection or all plans."""
    token = secrets.token_urlsafe(16)

    with get_cursor(commit=True) as cur:
        cur.execute(
            """
            INSERT INTO plan_shares (share_token, owner_user_id, collection_name)
            VALUES (%s, %s, %s)
            """,
            (token, user_id, collection_name),
        )

    return {"share_token": token}


def get_shared_plan(token: str) -> dict[str, Any] | None:
    """Public read-only payload for a share link. No auth required."""
    with get_cursor() as cur:
        cur.execute(
            "SELECT owner_user_id, collection_name FROM plan_shares WHERE share_token = %s",
            (token,),
        )
        share = cur.fetchone()
        if not share:
            return None

        owner_user_id = int(share["owner_user_id"])
        scope_collection = share["collection_name"]

        cur.execute("SELECT name FROM travelers WHERE user_id = %s", (owner_user_id,))
        owner = cur.fetchone()

        cur.execute(
            """
            SELECT spi.item_type, spi.item_id, spi.collection_name
            FROM saved_plan_items spi
            WHERE spi.user_id = %s AND spi.item_type IN ('activity', 'lodging')
            ORDER BY spi.saved_at DESC
            """,
            (owner_user_id,),
        )
        saved_rows = cur.fetchall()
        if scope_collection is not None:
            saved_rows = [r for r in saved_rows if r["collection_name"] == scope_collection]

        activity_ids = [r["item_id"] for r in saved_rows if r["item_type"] == "activity"]
        lodging_ids = [r["item_id"] for r in saved_rows if r["item_type"] == "lodging"]

        activities_by_id: dict[int, dict[str, Any]] = {}
        if activity_ids:
            cur.execute(
                """
                SELECT activity_id, title, address, thumbnail_url, cost, link_url,
                       latitude, longitude
                FROM activities
                WHERE activity_id = ANY(%s)
                """,
                (activity_ids,),
            )
            activities_by_id = {int(r["activity_id"]): dict(r) for r in cur.fetchall()}

        lodgings_by_id: dict[int, dict[str, Any]] = {}
        if lodging_ids:
            cur.execute(
                """
                SELECT lodge_id, title, address, thumbnail_url, cost, link_url,
                       latitude, longitude
                FROM lodgings
                WHERE lodge_id = ANY(%s)
                """,
                (lodging_ids,),
            )
            lodgings_by_id = {int(r["lodge_id"]): dict(r) for r in cur.fetchall()}

        cur.execute(
            """
            SELECT custom_item_id, title, notes, address, cost, collection_name, link_url,
                   item_type, description, thumbnail_url, latitude, longitude
            FROM plan_custom_items
            WHERE owner_user_id = %s
            ORDER BY created_at DESC, custom_item_id DESC
            """,
            (owner_user_id,),
        )
        custom_items = cur.fetchall()
        if scope_collection is not None:
            custom_items = [r for r in custom_items if r["collection_name"] == scope_collection]

        try:
            cur.execute(
                """
                SELECT flight_id, airline, flight_number, origin_code, destination_code,
                       departure_date, outbound_date, return_date, outbound_legs, return_legs,
                       departure_time, price, price_minor, currency, collection_name, link_url, notes
                FROM plan_flights
                WHERE owner_user_id = %s
                ORDER BY created_at DESC, flight_id DESC
                """,
                (owner_user_id,),
            )
            flight_rows = cur.fetchall()
        except psycopg2.errors.UndefinedTable:
            cur.connection.rollback()
            flight_rows = []
        if scope_collection is not None:
            flight_rows = [r for r in flight_rows if r["collection_name"] == scope_collection]

    def _group_name(value: Any) -> str:
        return value if value else "Unsorted"

    groups: dict[str, dict[str, Any]] = {}

    def _group(name: str) -> dict[str, Any]:
        return groups.setdefault(name, {
            "name": name,
            "activities": [],
            "lodgings": [],
            "custom_items": [],
            "flights": [],
        })

    for row in saved_rows:
        collection = _group(_group_name(row["collection_name"]))
        if row["item_type"] == "activity" and int(row["item_id"]) in activities_by_id:
            data = activities_by_id[int(row["item_id"])]
            collection["activities"].append({
                "title": data.get("title"),
                "address": data.get("address"),
                "thumbnail_url": data.get("thumbnail_url"),
                "cost": float(data["cost"]) if data.get("cost") is not None else None,
                "link_url": data.get("link_url"),
                "latitude": _as_optional_float(data.get("latitude")),
                "longitude": _as_optional_float(data.get("longitude")),
            })
        elif row["item_type"] == "lodging" and int(row["item_id"]) in lodgings_by_id:
            data = lodgings_by_id[int(row["item_id"])]
            collection["lodgings"].append({
                "title": data.get("title"),
                "address": data.get("address"),
                "thumbnail_url": data.get("thumbnail_url"),
                "cost": float(data["cost"]) if data.get("cost") is not None else None,
                "link_url": data.get("link_url"),
                "latitude": _as_optional_float(data.get("latitude")),
                "longitude": _as_optional_float(data.get("longitude")),
            })

    for row in custom_items:
        collection = _group(_group_name(row["collection_name"]))
        item_type = (row.get("item_type") or "activity").lower()
        stop = {
            "title": row.get("title"),
            "address": row.get("address"),
            "thumbnail_url": row.get("thumbnail_url"),
            "cost": _as_optional_float(row.get("cost")),
            "link_url": row.get("link_url"),
            "description": row.get("notes") or row.get("description"),
            "latitude": _as_optional_float(row.get("latitude")),
            "longitude": _as_optional_float(row.get("longitude")),
        }
        if item_type == "lodging":
            collection["lodgings"].append(stop)
        else:
            collection["activities"].append(stop)

    for row in flight_rows:
        collection = _group(_group_name(row["collection_name"]))
        collection["flights"].append({
            "airline": row.get("airline"),
            "flight_number": row.get("flight_number"),
            "origin_code": row.get("origin_code"),
            "destination_code": row.get("destination_code"),
            "departure_date": row.get("departure_date"),
            "outbound_date": row.get("outbound_date") or row.get("departure_date"),
            "return_date": row.get("return_date"),
            "outbound_legs": row.get("outbound_legs") or [],
            "return_legs": row.get("return_legs") or [],
            "departure_time": row.get("departure_time"),
            "price": row.get("price"),
            "price_minor": row.get("price_minor"),
            "currency": row.get("currency"),
            "link_url": row.get("link_url"),
            "notes": row.get("notes"),
        })

    ordered_groups = sorted(groups.values(), key=lambda g: (g["name"] == "Unsorted", g["name"]))

    return {
        "owner_name": owner.get("name") if owner else None,
        "scope": scope_collection,
        "groups": ordered_groups,
    }
