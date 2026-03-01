from __future__ import annotations

from collections import defaultdict
from datetime import datetime
from decimal import Decimal, InvalidOperation
import re
from typing import Any

from db import get_cursor
from services.auth_service import to_nullable_string

VALID_VISIBILITY = {"public", "private", "friends"}
VALID_DURATION = {"multiday trip", "day trip", "overnight trip"}


class TripValidationError(ValueError):
    pass


class TripNotFoundError(LookupError):
    pass


class TripForbiddenError(PermissionError):
    pass


def _as_float(value: Any) -> float | None:
    if value is None:
        return None
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, (int, float)):
        return float(value)
    text = str(value).strip()
    if not text:
        return None
    try:
        return float(text)
    except ValueError:
        return None


def _as_datetime_iso(value: Any) -> str | None:
    if isinstance(value, datetime):
        return value.isoformat()
    return None


def _serialize_trip_base(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "trip_id": int(row["trip_id"]),
        "thumbnail_url": row.get("thumbnail_url"),
        "title": row.get("title") or "",
        "description": row.get("description"),
        "latitude": _as_float(row.get("latitude")),
        "longitude": _as_float(row.get("longitude")),
        "cost": _as_float(row.get("cost")),
        "duration": row.get("duration"),
        "date": row.get("date"),
        "visibility": row.get("visibility") or "public",
        "owner_user_id": int(row["owner_user_id"]),
        "owner": {
            "user_id": int(row["owner_user_id"]),
            "name": row.get("owner_name"),
            "bio": row.get("owner_bio"),
            "verified": bool(row.get("owner_verified")),
            "college": row.get("owner_college"),
            "profile_image_url": row.get("owner_profile_image_url"),
        },
        "tags": [],
        "lodgings": [],
        "activities": [],
        "comments": [],
    }


def _hydrate_trip_children(trips: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if not trips:
        return trips

    trip_ids = [trip["trip_id"] for trip in trips]

    tags_by_trip: dict[int, list[str]] = defaultdict(list)
    lodgings_by_trip: dict[int, list[dict[str, Any]]] = defaultdict(list)
    activities_by_trip: dict[int, list[dict[str, Any]]] = defaultdict(list)
    comments_by_trip: dict[int, list[dict[str, Any]]] = defaultdict(list)

    with get_cursor() as cur:
        cur.execute(
            """
            SELECT trip_id, tag
            FROM trip_tags
            WHERE trip_id = ANY(%s)
            ORDER BY tag ASC
            """,
            (trip_ids,),
        )
        for row in cur.fetchall():
            tags_by_trip[int(row["trip_id"])].append(row["tag"])

        cur.execute(
            """
            SELECT lodge_id, trip_id, address, thumbnail_url, title, description, latitude, longitude, cost
            FROM lodgings
            WHERE trip_id = ANY(%s)
            ORDER BY lodge_id ASC
            """,
            (trip_ids,),
        )
        for row in cur.fetchall():
            lodgings_by_trip[int(row["trip_id"])].append(
                {
                    "lodge_id": int(row["lodge_id"]),
                    "trip_id": int(row["trip_id"]),
                    "address": row.get("address"),
                    "thumbnail_url": row.get("thumbnail_url"),
                    "title": row.get("title"),
                    "description": row.get("description"),
                    "latitude": _as_float(row.get("latitude")),
                    "longitude": _as_float(row.get("longitude")),
                    "cost": _as_float(row.get("cost")),
                }
            )

        cur.execute(
            """
            SELECT activity_id, trip_id, address, thumbnail_url, title, location, description, latitude, longitude, cost
            FROM activities
            WHERE trip_id = ANY(%s)
            ORDER BY activity_id ASC
            """,
            (trip_ids,),
        )
        for row in cur.fetchall():
            activities_by_trip[int(row["trip_id"])].append(
                {
                    "activity_id": int(row["activity_id"]),
                    "trip_id": int(row["trip_id"]),
                    "address": row.get("address"),
                    "thumbnail_url": row.get("thumbnail_url"),
                    "title": row.get("title"),
                    "location": row.get("location"),
                    "description": row.get("description"),
                    "latitude": _as_float(row.get("latitude")),
                    "longitude": _as_float(row.get("longitude")),
                    "cost": _as_float(row.get("cost")),
                }
            )

        cur.execute(
            """
            SELECT c.comment_id, c.user_id, c.trip_id, c.body, c.created_at, u.name AS user_name
            FROM comments c
            JOIN travelers u ON u.user_id = c.user_id
            WHERE c.trip_id = ANY(%s)
            ORDER BY c.created_at DESC
            """,
            (trip_ids,),
        )
        for row in cur.fetchall():
            comments_by_trip[int(row["trip_id"])].append(
                {
                    "comment_id": int(row["comment_id"]),
                    "user_id": int(row["user_id"]),
                    "trip_id": int(row["trip_id"]),
                    "body": row.get("body") or "",
                    "created_at": _as_datetime_iso(row.get("created_at")),
                    "user_name": row.get("user_name"),
                }
            )

    for trip in trips:
        trip_id = trip["trip_id"]
        trip["tags"] = tags_by_trip[trip_id]
        trip["lodgings"] = lodgings_by_trip[trip_id]
        trip["activities"] = activities_by_trip[trip_id]
        trip["comments"] = comments_by_trip[trip_id]

    return trips


def _fetch_trip_rows(where_sql: str, params: tuple[Any, ...]) -> list[dict[str, Any]]:
    with get_cursor() as cur:
        cur.execute(
            f"""
            SELECT
                t.trip_id,
                t.thumbnail_url,
                t.title,
                t.description,
                t.latitude,
                t.longitude,
                t.cost,
                t.duration,
                t.date,
                t.visibility,
                t.owner_user_id,
                o.name AS owner_name,
                o.bio AS owner_bio,
                o.verified AS owner_verified,
                o.college AS owner_college,
                o.profile_image_url AS owner_profile_image_url
            FROM trips t
            JOIN travelers o ON o.user_id = t.owner_user_id
            WHERE {where_sql}
            ORDER BY t.trip_id DESC
            """,
            params,
        )
        rows = cur.fetchall()

    return [_serialize_trip_base(row) for row in rows]


def list_trips(viewer_user_id: int | None) -> list[dict[str, Any]]:
    if viewer_user_id is None:
        trips = _fetch_trip_rows("t.visibility = 'public'", tuple())
    else:
        trips = _fetch_trip_rows("(t.visibility = 'public' OR t.owner_user_id = %s)", (viewer_user_id,))
    return _hydrate_trip_children(trips)


def list_user_trips(target_user_id: int, viewer_user_id: int | None) -> list[dict[str, Any]]:
    if viewer_user_id == target_user_id:
        trips = _fetch_trip_rows("t.owner_user_id = %s", (target_user_id,))
    else:
        trips = _fetch_trip_rows("(t.owner_user_id = %s AND t.visibility = 'public')", (target_user_id,))
    return _hydrate_trip_children(trips)


def get_trip(trip_id: int, viewer_user_id: int | None) -> dict[str, Any] | None:
    trips = _fetch_trip_rows("t.trip_id = %s", (trip_id,))
    if not trips:
        return None

    trip = trips[0]
    is_owner = viewer_user_id == trip["owner_user_id"]
    if trip["visibility"] != "public" and not is_owner:
        return None

    return _hydrate_trip_children([trip])[0]


def _parse_visibility(value: Any) -> str:
    candidate = (to_nullable_string(value) or "public").lower()
    return candidate if candidate in VALID_VISIBILITY else "public"


def _parse_duration(value: Any) -> str:
    candidate = to_nullable_string(value) or "multiday trip"
    return candidate if candidate in VALID_DURATION else "multiday trip"


def _parse_trip_date(value: Any) -> str | None:
    candidate = to_nullable_string(value)
    if not candidate:
        return None

    # Accept HTML month input format directly.
    if re.fullmatch(r"\d{4}-\d{2}", candidate):
        return candidate

    # Accept MM-YYYY (7 chars) and MM-YY (5 chars).
    if re.fullmatch(r"\d{2}-\d{4}", candidate) or re.fullmatch(r"\d{2}-\d{2}", candidate):
        return candidate

    # Allow a friendly free-form month/year and normalize it.
    for fmt in ("%B %Y", "%b %Y"):
        try:
            parsed = datetime.strptime(candidate, fmt)
            return parsed.strftime("%Y-%m")
        except ValueError:
            continue

    raise TripValidationError("date must use YYYY-MM, MM-YYYY, MM-YY, or 'Month YYYY'")


def _parse_thumbnail_url(value: Any) -> str | None:
    candidate = to_nullable_string(value)
    if not candidate:
        return None

    lowered = candidate.lower()
    if lowered.startswith("data:"):
        raise TripValidationError("thumbnail_url must be an image URL, not base64 data")

    if not (lowered.startswith("http://") or lowered.startswith("https://")):
        raise TripValidationError("thumbnail_url must start with http:// or https://")

    return candidate


def _parse_decimal(
    value: Any,
    *,
    field_name: str,
    minimum: Decimal | None = None,
    maximum: Decimal | None = None,
    allow_currency_chars: bool = False,
) -> Decimal | None:
    candidate = to_nullable_string(value)
    if not candidate:
        return None

    normalized = candidate.strip()
    if allow_currency_chars:
        normalized = normalized.replace("$", "").replace(",", "")

    try:
        parsed = Decimal(normalized)
    except (InvalidOperation, ValueError):
        raise TripValidationError(f"{field_name} must be a valid number")

    if minimum is not None and parsed < minimum:
        raise TripValidationError(f"{field_name} must be at least {minimum}")
    if maximum is not None and parsed > maximum:
        raise TripValidationError(f"{field_name} must be at most {maximum}")

    return parsed


def _parse_latitude(value: Any, *, field_name: str = "latitude") -> Decimal | None:
    return _parse_decimal(value, field_name=field_name, minimum=Decimal("-90"), maximum=Decimal("90"))


def _parse_longitude(value: Any, *, field_name: str = "longitude") -> Decimal | None:
    return _parse_decimal(value, field_name=field_name, minimum=Decimal("-180"), maximum=Decimal("180"))


def _parse_cost(value: Any, *, field_name: str = "cost") -> Decimal | None:
    return _parse_decimal(
        value,
        field_name=field_name,
        minimum=Decimal("0"),
        allow_currency_chars=True,
    )


def _insert_tags(cur, *, trip_id: int, tags: list[Any]):
    for tag in tags:
        clean_tag = to_nullable_string(tag)
        if not clean_tag:
            continue

        cur.execute(
            """
            INSERT INTO trip_tags (trip_id, tag)
            VALUES (%s, %s)
            ON CONFLICT (trip_id, tag) DO NOTHING
            """,
            (trip_id, clean_tag),
        )


def _insert_lodgings(cur, *, trip_id: int, lodgings: list[Any]):
    for index, lodging in enumerate(lodgings):
        if not isinstance(lodging, dict):
            continue

        field_prefix = f"lodgings[{index + 1}]"
        latitude = _parse_latitude(lodging.get("latitude"), field_name=f"{field_prefix}.latitude")
        longitude = _parse_longitude(lodging.get("longitude"), field_name=f"{field_prefix}.longitude")
        cost = _parse_cost(lodging.get("cost"), field_name=f"{field_prefix}.cost")

        cur.execute(
            """
            INSERT INTO lodgings (
                trip_id,
                address,
                thumbnail_url,
                title,
                description,
                latitude,
                longitude,
                cost
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                trip_id,
                to_nullable_string(lodging.get("address")),
                _parse_thumbnail_url(lodging.get("thumbnail_url")),
                to_nullable_string(lodging.get("title")),
                to_nullable_string(lodging.get("description")),
                latitude,
                longitude,
                cost,
            ),
        )


def _insert_activities(cur, *, trip_id: int, activities: list[Any]):
    for index, activity in enumerate(activities):
        if not isinstance(activity, dict):
            continue

        field_prefix = f"activities[{index + 1}]"
        latitude = _parse_latitude(activity.get("latitude"), field_name=f"{field_prefix}.latitude")
        longitude = _parse_longitude(activity.get("longitude"), field_name=f"{field_prefix}.longitude")
        cost = _parse_cost(activity.get("cost"), field_name=f"{field_prefix}.cost")

        cur.execute(
            """
            INSERT INTO activities (
                trip_id,
                address,
                thumbnail_url,
                title,
                location,
                description,
                latitude,
                longitude,
                cost
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                trip_id,
                to_nullable_string(activity.get("address")),
                _parse_thumbnail_url(activity.get("thumbnail_url")),
                to_nullable_string(activity.get("title")),
                to_nullable_string(activity.get("location")),
                to_nullable_string(activity.get("description")),
                latitude,
                longitude,
                cost,
            ),
        )


def create_trip(*, owner_user_id: int, payload: dict[str, Any]) -> dict[str, Any]:
    title = to_nullable_string(payload.get("title"))
    if not title:
        raise TripValidationError("title is required")

    lodgings = payload.get("lodgings") or []
    activities = payload.get("activities") or []
    tags = payload.get("tags") or []

    if not isinstance(lodgings, list):
        raise TripValidationError("lodgings must be a list")
    if not isinstance(activities, list):
        raise TripValidationError("activities must be a list")
    if not isinstance(tags, list):
        raise TripValidationError("tags must be a list")

    with get_cursor(commit=True) as cur:
        cur.execute(
            """
            INSERT INTO trips (
                thumbnail_url,
                title,
                description,
                latitude,
                longitude,
                cost,
                duration,
                date,
                visibility,
                owner_user_id
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING trip_id
            """,
            (
                _parse_thumbnail_url(payload.get("thumbnail_url")),
                title,
                to_nullable_string(payload.get("description")),
                _parse_latitude(payload.get("latitude")),
                _parse_longitude(payload.get("longitude")),
                _parse_cost(payload.get("cost")),
                _parse_duration(payload.get("duration")),
                _parse_trip_date(payload.get("date")),
                _parse_visibility(payload.get("visibility")),
                owner_user_id,
            ),
        )

        created = cur.fetchone()
        if not created:
            raise TripValidationError("failed to create trip")

        trip_id = int(created["trip_id"])

        _insert_tags(cur, trip_id=trip_id, tags=tags)
        _insert_lodgings(cur, trip_id=trip_id, lodgings=lodgings)
        _insert_activities(cur, trip_id=trip_id, activities=activities)

    created_trip = get_trip(trip_id, owner_user_id)
    if not created_trip:
        raise TripValidationError("failed to load created trip")

    return created_trip


def _require_trip_owner(*, trip_id: int, user_id: int):
    with get_cursor() as cur:
        cur.execute("SELECT owner_user_id FROM trips WHERE trip_id = %s", (trip_id,))
        row = cur.fetchone()

    if not row:
        raise TripNotFoundError("trip not found")

    owner_user_id = int(row["owner_user_id"])
    if owner_user_id != user_id:
        raise TripForbiddenError("only the trip owner can edit this trip")


def add_lodging(*, trip_id: int, owner_user_id: int, payload: dict[str, Any]) -> dict[str, Any]:
    _require_trip_owner(trip_id=trip_id, user_id=owner_user_id)

    title = to_nullable_string(payload.get("title"))
    if not title:
        raise TripValidationError("title is required")

    with get_cursor(commit=True) as cur:
        cur.execute(
            """
            INSERT INTO lodgings (
                trip_id,
                address,
                thumbnail_url,
                title,
                description,
                latitude,
                longitude,
                cost
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING lodge_id
            """,
            (
                trip_id,
                to_nullable_string(payload.get("address")),
                _parse_thumbnail_url(payload.get("thumbnail_url")),
                title,
                to_nullable_string(payload.get("description")),
                _parse_latitude(payload.get("latitude")),
                _parse_longitude(payload.get("longitude")),
                _parse_cost(payload.get("cost")),
            ),
        )
        row = cur.fetchone()

    if not row:
        raise TripValidationError("failed to create lodging")

    return {
        "lodge_id": int(row["lodge_id"]),
        "trip_id": trip_id,
    }


def add_activity(*, trip_id: int, owner_user_id: int, payload: dict[str, Any]) -> dict[str, Any]:
    _require_trip_owner(trip_id=trip_id, user_id=owner_user_id)

    title = to_nullable_string(payload.get("title"))
    if not title:
        raise TripValidationError("title is required")

    with get_cursor(commit=True) as cur:
        cur.execute(
            """
            INSERT INTO activities (
                trip_id,
                address,
                thumbnail_url,
                title,
                location,
                description,
                latitude,
                longitude,
                cost
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING activity_id
            """,
            (
                trip_id,
                to_nullable_string(payload.get("address")),
                _parse_thumbnail_url(payload.get("thumbnail_url")),
                title,
                to_nullable_string(payload.get("location")),
                to_nullable_string(payload.get("description")),
                _parse_latitude(payload.get("latitude")),
                _parse_longitude(payload.get("longitude")),
                _parse_cost(payload.get("cost")),
            ),
        )
        row = cur.fetchone()

    if not row:
        raise TripValidationError("failed to create activity")

    return {
        "activity_id": int(row["activity_id"]),
        "trip_id": trip_id,
    }


def delete_trip(*, trip_id: int, owner_user_id: int):
    _require_trip_owner(trip_id=trip_id, user_id=owner_user_id)

    with get_cursor(commit=True) as cur:
        cur.execute("DELETE FROM trips WHERE trip_id = %s", (trip_id,))
        if cur.rowcount < 1:
            raise TripNotFoundError("trip not found")


def get_user_profile(*, user_id: int, viewer_user_id: int | None) -> dict[str, Any] | None:
    with get_cursor() as cur:
        cur.execute(
            """
            SELECT user_id, name, email, bio, verified, college, profile_image_url
            FROM travelers
            WHERE user_id = %s
            LIMIT 1
            """,
            (user_id,),
        )
        user_row = cur.fetchone()

    if not user_row:
        return None

    trips = list_user_trips(target_user_id=user_id, viewer_user_id=viewer_user_id)
    trip_entries = [
        {
            "trip_id": trip["trip_id"],
            "title": trip["title"],
            "thumbnail_url": trip["thumbnail_url"],
            "date": trip["date"],
            "latitude": trip["latitude"],
            "longitude": trip["longitude"],
        }
        for trip in trips
    ]

    return {
        "user": {
            "user_id": int(user_row["user_id"]),
            "name": user_row.get("name"),
            "email": user_row.get("email"),
            "bio": user_row.get("bio"),
            "verified": bool(user_row.get("verified")),
            "college": user_row.get("college"),
            "profile_image_url": user_row.get("profile_image_url"),
        },
        "trips": trip_entries,
    }
