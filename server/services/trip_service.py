from __future__ import annotations

from collections import defaultdict
from copy import deepcopy
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
import re
from threading import Lock
from time import monotonic
from typing import Any

from db import get_cursor
from services.auth_service import to_nullable_string
from services.trip_priority import score_trip_priority

VALID_VISIBILITY = {"public", "private", "friends"}
VALID_DURATION = {"multiday trip", "day trip", "overnight trip"}
TRIP_LIST_CACHE_TTL_SECONDS = 30


_trip_list_cache_lock = Lock()
_trip_list_cache_version = 0
_trip_list_cache: dict[int | None, tuple[float, int, list[dict[str, Any]]]] = {}

BoundingBox = tuple[float, float, float, float]


class TripValidationError(ValueError):
    pass


class TripNotFoundError(LookupError):
    pass


class TripForbiddenError(PermissionError):
    pass

def invalidate_trip_list_cache() -> None:
    global _trip_list_cache_version

    with _trip_list_cache_lock:
        _trip_list_cache_version += 1
        _trip_list_cache.clear()


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
        "event_start": _as_datetime_iso(row.get("event_start")),
        "event_end": _as_datetime_iso(row.get("event_end")),
    }


def _prepare_trip_priority_on_write(trip: dict[str, Any]) -> None:
    """
    Compute priority during create/update flows so the write path is ready for
    future persistence/analytics hooks.

    Intentionally does not mutate the trip payload returned to clients and does
    not write to the database.
    """
    score_trip_priority(trip)


def _hydrate_trip_children(trips: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if not trips:
        return trips

    trip_ids = [trip["trip_id"] for trip in trips]

    tags_by_trip, lodgings_by_trip, activities_by_trip, comments_by_trip = _fetch_trip_children_by_ids(trip_ids)

    for trip in trips:
        trip_id = trip["trip_id"]
        trip["tags"] = tags_by_trip[trip_id]
        trip["lodgings"] = lodgings_by_trip[trip_id]
        trip["activities"] = activities_by_trip[trip_id]
        trip["comments"] = comments_by_trip[trip_id]

    return trips


def _fetch_trip_children_by_ids(
    trip_ids: list[int]
) -> tuple[
    dict[int, list[str]],
    dict[int, list[dict[str, Any]]],
    dict[int, list[dict[str, Any]]],
    dict[int, list[dict[str, Any]]],
]:
    if not trip_ids:
        return defaultdict(list), defaultdict(list), defaultdict(list), defaultdict(list)

    tags_by_trip: dict[int, list[str]] = defaultdict(list)
    lodgings_by_trip: dict[int, list[dict[str, Any]]] = defaultdict(list)
    activities_by_trip: dict[int, list[dict[str, Any]]] = defaultdict(list)
    comments_by_trip: dict[int, list[dict[str, Any]]] = defaultdict(list)

    with get_cursor() as cur:
        cur.execute(
            """
            WITH ids AS (
                SELECT DISTINCT unnest(%s::int[]) AS trip_id
            )
            SELECT
                ids.trip_id,
                COALESCE(tags.tags, '[]'::jsonb) AS tags,
                COALESCE(lodgings.lodgings, '[]'::jsonb) AS lodgings,
                COALESCE(activities.activities, '[]'::jsonb) AS activities,
                COALESCE(comments.comments, '[]'::jsonb) AS comments
            FROM ids
            LEFT JOIN LATERAL (
                SELECT jsonb_agg(tt.tag ORDER BY tt.tag) AS tags
                FROM trip_tags tt
                WHERE tt.trip_id = ids.trip_id
            ) tags ON TRUE
            LEFT JOIN LATERAL (
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'lodge_id', l.lodge_id,
                        'trip_id', l.trip_id,
                        'address', l.address,
                        'thumbnail_url', l.thumbnail_url,
                        'title', l.title,
                        'description', l.description,
                        'latitude', ST_Y(l.geo_location::geometry),
                        'longitude', ST_X(l.geo_location::geometry),
                        'cost', l.cost
                    )
                    ORDER BY l.lodge_id
                ) AS lodgings
                FROM lodgings l
                WHERE l.trip_id = ids.trip_id
            ) lodgings ON TRUE
            LEFT JOIN LATERAL (
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'activity_id', a.activity_id,
                        'trip_id', a.trip_id,
                        'address', a.address,
                        'thumbnail_url', a.thumbnail_url,
                        'title', a.title,
                        'location', a.location,
                        'description', a.description,
                        'latitude', ST_Y(a.geo_location::geometry),
                        'longitude', ST_X(a.geo_location::geometry),
                        'cost', a.cost
                    )
                    ORDER BY a.activity_id
                ) AS activities
                FROM activities a
                WHERE a.trip_id = ids.trip_id
            ) activities ON TRUE
            LEFT JOIN LATERAL (
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'comment_id', c.comment_id,
                        'user_id', c.user_id,
                        'trip_id', c.trip_id,
                        'body', c.body,
                        'created_at', c.created_at,
                        'user_name', u.name,
                        'user_profile_image_url', u.profile_image_url
                    )
                    ORDER BY c.created_at DESC
                ) AS comments
                FROM comments c
                JOIN travelers u ON u.user_id = c.user_id
                WHERE c.trip_id = ids.trip_id
            ) comments ON TRUE
            ORDER BY ids.trip_id DESC
            """,
            (trip_ids,),
        )

        for row in cur.fetchall():
            trip_id = int(row["trip_id"])

            raw_tags = row.get("tags") or []
            tags_by_trip[trip_id] = [str(tag) for tag in raw_tags if tag is not None and str(tag).strip()]

            raw_lodgings = row.get("lodgings") or []
            lodgings_by_trip[trip_id] = [
                {
                    "lodge_id": int(lodging["lodge_id"]),
                    "trip_id": int(lodging["trip_id"]),
                    "address": lodging.get("address"),
                    "thumbnail_url": lodging.get("thumbnail_url"),
                    "title": lodging.get("title"),
                    "description": lodging.get("description"),
                    "latitude": _as_float(lodging.get("latitude")),
                    "longitude": _as_float(lodging.get("longitude")),
                    "cost": _as_float(lodging.get("cost")),
                }
                for lodging in raw_lodgings
            ]

            raw_activities = row.get("activities") or []
            activities_by_trip[trip_id] = [
                {
                    "activity_id": int(activity["activity_id"]),
                    "trip_id": int(activity["trip_id"]),
                    "address": activity.get("address"),
                    "thumbnail_url": activity.get("thumbnail_url"),
                    "title": activity.get("title"),
                    "location": activity.get("location"),
                    "description": activity.get("description"),
                    "latitude": _as_float(activity.get("latitude")),
                    "longitude": _as_float(activity.get("longitude")),
                    "cost": _as_float(activity.get("cost")),
                }
                for activity in raw_activities
            ]

            raw_comments = row.get("comments") or []
            comments_by_trip[trip_id] = [
                {
                    "comment_id": int(comment["comment_id"]),
                    "user_id": int(comment["user_id"]),
                    "trip_id": int(comment["trip_id"]),
                    "body": comment.get("body") or "",
                    "created_at": _as_datetime_iso(comment.get("created_at")),
                    "user_name": comment.get("user_name"),
                    "user_profile_image_url": comment.get("user_profile_image_url"),
                }
                for comment in raw_comments
            ]

    return tags_by_trip, lodgings_by_trip, activities_by_trip, comments_by_trip


def _fetch_trip_rows(where_sql: str, params: tuple[Any, ...]) -> list[dict[str, Any]]:
    with get_cursor() as cur:
        cur.execute(
            f"""
            SELECT
                t.trip_id,
                t.thumbnail_url,
                t.title,
                t.description,
                ST_Y(t.geo_location::geometry) AS latitude,
                ST_X(t.geo_location::geometry) AS longitude,
                t.cost,
                t.duration,
                t.date,
                t.visibility,
                t.owner_user_id,
                t.event_start,
                t.event_end,
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


#TODO: only implemented on trips rn since that's the main entity, but may want to extend to activities/lodgings later
def _append_bounding_box_filter(
    where_sql: str,
    params: tuple[Any, ...],
    bounding_box: BoundingBox | None,
) -> tuple[str, tuple[Any, ...]]:
    if bounding_box is None:
        return where_sql, params

    min_lat, max_lat, min_lng, max_lng = bounding_box
    where_with_bbox = (
        f"({where_sql})"
        " AND t.geo_location IS NOT NULL"
        " AND t.geo_location::geometry && ST_MakeEnvelope(%s, %s, %s, %s, 4326)"
    )
    return where_with_bbox, params + (min_lng, min_lat, max_lng, max_lat)


def _are_friends(user_id_a: int, user_id_b: int) -> bool:
    with get_cursor() as cur:
        cur.execute(
            """
            SELECT 1 FROM friendships
            WHERE status = 'accepted'
            AND ((requester_id = %s AND addressee_id = %s) OR (requester_id = %s AND addressee_id = %s))
            LIMIT 1
            """,
            (user_id_a, user_id_b, user_id_b, user_id_a),
        )
        return cur.fetchone() is not None


def _filter_trips_by_visibility(trips: list[dict[str, Any]], viewer_user_id: int | None) -> list[dict[str, Any]]:
    """Filter trips based on visibility rules and viewer permissions."""
    visible_trips = []
    for trip in trips:
        visibility = trip["visibility"]
        owner_id = trip["owner_user_id"]
        
        if visibility == "public":
            visible_trips.append(trip)
        elif visibility == "private":
            if viewer_user_id == owner_id:
                visible_trips.append(trip)
        elif visibility == "friends":
            if viewer_user_id == owner_id:
                visible_trips.append(trip)
            elif viewer_user_id is not None and _are_friends(viewer_user_id, owner_id):
                visible_trips.append(trip)
    
    return visible_trips


def _maybe_hydrate_trips(trips: list[dict[str, Any]], include_children: bool) -> list[dict[str, Any]]:
    """Conditionally hydrate trips with children based on include_children flag."""
    if not include_children:
        return trips
    return _hydrate_trip_children(trips)


def _list_non_public_visible_trip_ids(
    viewer_user_id: int | None,
    bounding_box: BoundingBox | None = None,
) -> list[int]:
    if viewer_user_id is None:
        return []

    where_sql, params = _append_bounding_box_filter(
        """(
            (t.owner_user_id = %s AND t.visibility <> 'public')
            OR (
                t.visibility = 'friends'
                AND t.owner_user_id <> %s
                AND EXISTS (
                    SELECT 1 FROM friendships f
                    WHERE f.status = 'accepted'
                    AND (
                        (f.requester_id = %s AND f.addressee_id = t.owner_user_id)
                        OR (f.requester_id = t.owner_user_id AND f.addressee_id = %s)
                    )
                )
            )
        )""",
        (viewer_user_id, viewer_user_id, viewer_user_id, viewer_user_id),
        bounding_box,
    )

    with get_cursor() as cur:
        cur.execute(
            f"""
            SELECT t.trip_id
            FROM trips t
            WHERE {where_sql}
            ORDER BY t.trip_id DESC
            """,
            params,
        )
        rows = cur.fetchall()

    return [int(row["trip_id"]) for row in rows]


def list_non_public_visible_trip_ids(
    viewer_user_id: int | None,
    bounding_box: BoundingBox | None = None,
) -> list[int]:
    return _list_non_public_visible_trip_ids(viewer_user_id=viewer_user_id, bounding_box=bounding_box)


def list_trips(
    viewer_user_id: int | None,
    bounding_box: BoundingBox | None = None,
    include_children: bool = True,
    public_only: bool = False,
) -> list[dict[str, Any]]:
    now = monotonic()

    # TODO: why only cache when no bounding box?
    # Only use cache for full hydrated trips
    if bounding_box is None and include_children:
        with _trip_list_cache_lock:
            cache_entry = _trip_list_cache.get(viewer_user_id)
            if cache_entry is not None:
                cached_at, cache_version, cached_value = cache_entry
                is_fresh = (now - cached_at) <= TRIP_LIST_CACHE_TTL_SECONDS
                if is_fresh and cache_version == _trip_list_cache_version:
                    return deepcopy(cached_value)

    if viewer_user_id is None or public_only:
        where_sql, params = _append_bounding_box_filter("t.visibility = 'public'", tuple(), bounding_box)
        trips = _fetch_trip_rows(where_sql, params)
    else:
        # First pass: public trips only (fast path).
        public_where_sql, public_params = _append_bounding_box_filter(
            "t.visibility = 'public'",
            tuple(),
            bounding_box,
        )
        public_trips = _fetch_trip_rows(public_where_sql, public_params)

        # Second pass: non-public trips the viewer can see (owner/friends checks).
        extra_trip_ids = _list_non_public_visible_trip_ids(
            viewer_user_id=viewer_user_id,
            bounding_box=bounding_box,
        )
        extra_trips = _fetch_trip_rows("t.trip_id = ANY(%s)", (extra_trip_ids,)) if extra_trip_ids else []

        # Merge and preserve global trip_id desc ordering.
        by_trip_id = {trip["trip_id"]: trip for trip in public_trips}
        for trip in extra_trips:
            by_trip_id[trip["trip_id"]] = trip
        trips = sorted(by_trip_id.values(), key=lambda trip: trip["trip_id"], reverse=True)

    result = _maybe_hydrate_trips(trips, include_children)

    if bounding_box is None and include_children:
        with _trip_list_cache_lock:
            _trip_list_cache[viewer_user_id] = (
                now,
                _trip_list_cache_version,
                deepcopy(result),
            )

    return result


def get_trips_by_ids(trip_ids: list[int], viewer_user_id: int | None) -> list[dict[str, Any]]:
    """Fetch specific trips by ID with SQL visibility checks and children hydration."""
    if not trip_ids:
        return []

    if viewer_user_id is None:
        where_sql = "t.trip_id = ANY(%s) AND t.visibility = 'public'"
        params: tuple[Any, ...] = (trip_ids,)
    else:
        where_sql = """(
            t.trip_id = ANY(%s)
            AND (
                t.visibility = 'public'
                OR t.owner_user_id = %s
                OR (
                    t.visibility = 'friends'
                    AND EXISTS (
                        SELECT 1 FROM friendships f
                        WHERE f.status = 'accepted'
                        AND (
                            (f.requester_id = %s AND f.addressee_id = t.owner_user_id)
                            OR (f.requester_id = t.owner_user_id AND f.addressee_id = %s)
                        )
                    )
                )
            )
        )"""
        params = (trip_ids, viewer_user_id, viewer_user_id, viewer_user_id)

    trips = _fetch_trip_rows(where_sql, params)
    return _maybe_hydrate_trips(trips, include_children=True)


def get_trip_children_by_ids(trip_ids: list[int], viewer_user_id: int | None) -> list[dict[str, Any]]:
    """Fetch children only for visible trips by ID, avoiding re-fetch of trip base fields."""
    if not trip_ids:
        return []

    if viewer_user_id is None:
        where_sql = "t.trip_id = ANY(%s) AND t.visibility = 'public'"
        params: tuple[Any, ...] = (trip_ids,)
    else:
        where_sql = """(
            t.trip_id = ANY(%s)
            AND (
                t.visibility = 'public'
                OR t.owner_user_id = %s
                OR (
                    t.visibility = 'friends'
                    AND EXISTS (
                        SELECT 1 FROM friendships f
                        WHERE f.status = 'accepted'
                        AND (
                            (f.requester_id = %s AND f.addressee_id = t.owner_user_id)
                            OR (f.requester_id = t.owner_user_id AND f.addressee_id = %s)
                        )
                    )
                )
            )
        )"""
        params = (trip_ids, viewer_user_id, viewer_user_id, viewer_user_id)

    visible_trip_rows = _fetch_trip_rows(where_sql, params)
    visible_trip_ids = [trip["trip_id"] for trip in visible_trip_rows]
    if not visible_trip_ids:
        return []

    tags_by_trip, lodgings_by_trip, activities_by_trip, comments_by_trip = _fetch_trip_children_by_ids(visible_trip_ids)

    return [
        {
            "trip_id": trip_id,
            "tags": tags_by_trip[trip_id],
            "lodgings": lodgings_by_trip[trip_id],
            "activities": activities_by_trip[trip_id],
            "comments": comments_by_trip[trip_id],
        }
        for trip_id in visible_trip_ids
    ]


def list_user_trips(target_user_id: int, viewer_user_id: int | None) -> list[dict[str, Any]]:
    if viewer_user_id == target_user_id:
        trips = _fetch_trip_rows("t.owner_user_id = %s", (target_user_id,))
    else:
        trips = _fetch_trip_rows(
            """(
                t.owner_user_id = %s
                AND (
                    t.visibility = 'public'
                    OR (
                        t.visibility = 'friends'
                        AND EXISTS (
                            SELECT 1 FROM friendships f
                            WHERE f.status = 'accepted'
                            AND (
                                (f.requester_id = %s AND f.addressee_id = %s)
                                OR (f.requester_id = %s AND f.addressee_id = %s)
                            )
                        )
                    )
                )
            )""",
            (target_user_id, viewer_user_id, target_user_id, target_user_id, viewer_user_id),
        )
    return _maybe_hydrate_trips(trips, include_children=True)


def get_trip(trip_id: int, viewer_user_id: int | None) -> dict[str, Any] | None:
    trips = _fetch_trip_rows("t.trip_id = %s", (trip_id,))
    if not trips:
        return None

    # Apply visibility filtering
    visible_trips = _filter_trips_by_visibility(trips, viewer_user_id)
    if not visible_trips:
        return None
    
    hydrated_trips = _maybe_hydrate_trips(visible_trips, include_children=True)
    return hydrated_trips[0]


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


def _parse_event_datetime(value: Any, *, field_name: str) -> datetime | None:
    candidate = to_nullable_string(value)
    if not candidate:
        return None

    try:
        parsed = datetime.fromisoformat(candidate.replace("Z", "+00:00"))
    except ValueError:
        raise TripValidationError(f"{field_name} must be a valid ISO 8601 datetime (e.g. 2025-03-01T14:00)")

    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)

    return parsed.astimezone(timezone.utc)


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


def _to_geo_wkt(latitude: Decimal | None, longitude: Decimal | None) -> str | None:
    if latitude is None or longitude is None:
        return None
    return f"SRID=4326;POINT({longitude} {latitude})"


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
        geo_location = _to_geo_wkt(latitude, longitude)
        cost = _parse_cost(lodging.get("cost"), field_name=f"{field_prefix}.cost")

        cur.execute(
            """
            INSERT INTO lodgings (
                trip_id,
                address,
                thumbnail_url,
                title,
                description,
                geo_location,
                cost
            )
            VALUES (%s, %s, %s, %s, %s, ST_GeogFromText(%s), %s)
            """,
            (
                trip_id,
                to_nullable_string(lodging.get("address")),
                _parse_thumbnail_url(lodging.get("thumbnail_url")),
                to_nullable_string(lodging.get("title")),
                to_nullable_string(lodging.get("description")),
                geo_location,
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
        geo_location = _to_geo_wkt(latitude, longitude)
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
                geo_location,
                cost
            )
            VALUES (%s, %s, %s, %s, %s, %s, ST_GeogFromText(%s), %s)
            """,
            (
                trip_id,
                to_nullable_string(activity.get("address")),
                _parse_thumbnail_url(activity.get("thumbnail_url")),
                to_nullable_string(activity.get("title")),
                to_nullable_string(activity.get("location")),
                to_nullable_string(activity.get("description")),
                geo_location,
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

    event_start = _parse_event_datetime(payload.get("event_start"), field_name="event_start")
    event_end = _parse_event_datetime(payload.get("event_end"), field_name="event_end")
    if (event_start is None) != (event_end is None):
        raise TripValidationError("event_start and event_end must both be provided for pop-up events")
    if event_start is not None and event_end is not None and event_end <= event_start:
        raise TripValidationError("event_end must be after event_start")
    is_popup_event = event_start is not None and event_end is not None
    if is_popup_event and lodgings:
        raise TripValidationError("pop-up events cannot include lodgings")
    if is_popup_event and activities:
        raise TripValidationError("pop-up events cannot include activities")

    duration = None if is_popup_event else _parse_duration(payload.get("duration"))
    date = None if is_popup_event else _parse_trip_date(payload.get("date"))
    latitude = _parse_latitude(payload.get("latitude"))
    longitude = _parse_longitude(payload.get("longitude"))
    geo_location = _to_geo_wkt(latitude, longitude)

    with get_cursor(commit=True) as cur:
        cur.execute(
            """
            INSERT INTO trips (
                thumbnail_url,
                title,
                description,
                geo_location,
                cost,
                duration,
                date,
                visibility,
                owner_user_id,
                event_start,
                event_end
            )
            VALUES (%s, %s, %s, ST_GeogFromText(%s), %s, %s, %s, %s, %s, %s, %s)
            RETURNING trip_id
            """,
            (
                _parse_thumbnail_url(payload.get("thumbnail_url")),
                title,
                to_nullable_string(payload.get("description")),
                geo_location,
                _parse_cost(payload.get("cost")),
                duration,
                date,
                _parse_visibility(payload.get("visibility")),
                owner_user_id,
                event_start,
                event_end,
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

    # Prepare quality scoring at write time without persisting or returning it yet.
    _prepare_trip_priority_on_write(created_trip)

    invalidate_trip_list_cache()

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

    latitude = _parse_latitude(payload.get("latitude"))
    longitude = _parse_longitude(payload.get("longitude"))
    geo_location = _to_geo_wkt(latitude, longitude)

    with get_cursor(commit=True) as cur:
        cur.execute(
            """
            INSERT INTO lodgings (
                trip_id,
                address,
                thumbnail_url,
                title,
                description,
                geo_location,
                cost
            )
            VALUES (%s, %s, %s, %s, %s, ST_GeogFromText(%s), %s)
            RETURNING lodge_id
            """,
            (
                trip_id,
                to_nullable_string(payload.get("address")),
                _parse_thumbnail_url(payload.get("thumbnail_url")),
                title,
                to_nullable_string(payload.get("description")),
                geo_location,
                _parse_cost(payload.get("cost")),
            ),
        )
        row = cur.fetchone()

    if not row:
        raise TripValidationError("failed to create lodging")

    invalidate_trip_list_cache()

    return {
        "lodge_id": int(row["lodge_id"]),
        "trip_id": trip_id,
    }


def add_activity(*, trip_id: int, owner_user_id: int, payload: dict[str, Any]) -> dict[str, Any]:
    _require_trip_owner(trip_id=trip_id, user_id=owner_user_id)

    title = to_nullable_string(payload.get("title"))
    if not title:
        raise TripValidationError("title is required")

    latitude = _parse_latitude(payload.get("latitude"))
    longitude = _parse_longitude(payload.get("longitude"))
    geo_location = _to_geo_wkt(latitude, longitude)

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
                geo_location,
                cost
            )
            VALUES (%s, %s, %s, %s, %s, %s, ST_GeogFromText(%s), %s)
            RETURNING activity_id
            """,
            (
                trip_id,
                to_nullable_string(payload.get("address")),
                _parse_thumbnail_url(payload.get("thumbnail_url")),
                title,
                to_nullable_string(payload.get("location")),
                to_nullable_string(payload.get("description")),
                geo_location,
                _parse_cost(payload.get("cost")),
            ),
        )
        row = cur.fetchone()

    if not row:
        raise TripValidationError("failed to create activity")

    invalidate_trip_list_cache()

    return {
        "activity_id": int(row["activity_id"]),
        "trip_id": trip_id,
    }


def update_trip(*, trip_id: int, owner_user_id: int, payload: dict[str, Any]) -> dict[str, Any]:
    _require_trip_owner(trip_id=trip_id, user_id=owner_user_id)

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

    event_start = _parse_event_datetime(payload.get("event_start"), field_name="event_start")
    event_end = _parse_event_datetime(payload.get("event_end"), field_name="event_end")
    if (event_start is None) != (event_end is None):
        raise TripValidationError("event_start and event_end must both be provided for pop-up events")
    if event_start is not None and event_end is not None and event_end <= event_start:
        raise TripValidationError("event_end must be after event_start")
    is_popup_event = event_start is not None and event_end is not None
    if is_popup_event and lodgings:
        raise TripValidationError("pop-up events cannot include lodgings")
    if is_popup_event and activities:
        raise TripValidationError("pop-up events cannot include activities")

    duration = None if is_popup_event else _parse_duration(payload.get("duration"))
    date = None if is_popup_event else _parse_trip_date(payload.get("date"))
    latitude = _parse_latitude(payload.get("latitude"))
    longitude = _parse_longitude(payload.get("longitude"))
    geo_location = _to_geo_wkt(latitude, longitude)

    with get_cursor(commit=True) as cur:
        cur.execute(
            """
            UPDATE trips SET
                thumbnail_url = %s,
                title = %s,
                description = %s,
                geo_location = ST_GeogFromText(%s),
                cost = %s,
                duration = %s,
                date = %s,
                visibility = %s,
                event_start = %s,
                event_end = %s
            WHERE trip_id = %s
            """,
            (
                _parse_thumbnail_url(payload.get("thumbnail_url")),
                title,
                to_nullable_string(payload.get("description")),
                geo_location,
                _parse_cost(payload.get("cost")),
                duration,
                date,
                _parse_visibility(payload.get("visibility")),
                event_start,
                event_end,
                trip_id,
            ),
        )
        if cur.rowcount < 1:
            raise TripNotFoundError("trip not found")

        cur.execute("DELETE FROM trip_tags WHERE trip_id = %s", (trip_id,))
        _insert_tags(cur, trip_id=trip_id, tags=tags)

        cur.execute("DELETE FROM lodgings WHERE trip_id = %s", (trip_id,))
        _insert_lodgings(cur, trip_id=trip_id, lodgings=lodgings)

        cur.execute("DELETE FROM activities WHERE trip_id = %s", (trip_id,))
        _insert_activities(cur, trip_id=trip_id, activities=activities)

    updated_trip = get_trip(trip_id, owner_user_id)
    if not updated_trip:
        raise TripValidationError("failed to load updated trip")

    # Prepare quality scoring at write time without persisting or returning it yet.
    _prepare_trip_priority_on_write(updated_trip)

    invalidate_trip_list_cache()

    return updated_trip


def delete_trip(*, trip_id: int, owner_user_id: int):
    _require_trip_owner(trip_id=trip_id, user_id=owner_user_id)

    with get_cursor(commit=True) as cur:
        cur.execute("DELETE FROM trips WHERE trip_id = %s", (trip_id,))
        if cur.rowcount < 1:
            raise TripNotFoundError("trip not found")

    invalidate_trip_list_cache()


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


def list_trip_comments(*, trip_id: int, viewer_user_id: int | None) -> list[dict[str, Any]]:
    trip = get_trip(trip_id=trip_id, viewer_user_id=viewer_user_id)
    if not trip:
        raise TripNotFoundError("trip not found")

    with get_cursor() as cur:
        cur.execute(
            """
            SELECT
                c.comment_id,
                c.user_id,
                c.trip_id,
                c.body,
                c.created_at,
                u.name AS user_name,
                u.profile_image_url AS user_profile_image_url
            FROM comments c
            JOIN travelers u ON u.user_id = c.user_id
            WHERE c.trip_id = %s
            ORDER BY c.created_at DESC
            """,
            (trip_id,),
        )
        rows = cur.fetchall()

    comments: list[dict[str, Any]] = []
    for row in rows:
        comments.append(
            {
                "comment_id": int(row["comment_id"]),
                "user_id": int(row["user_id"]),
                "trip_id": int(row["trip_id"]),
                "body": row.get("body") or "",
                "created_at": _as_datetime_iso(row.get("created_at")),
                "user_name": row.get("user_name"),
                "user_profile_image_url": row.get("user_profile_image_url"),
            }
        )

    return comments


def create_trip_comment(*, trip_id: int, user_id: int, body: Any) -> dict[str, Any]:
    trip = get_trip(trip_id=trip_id, viewer_user_id=user_id)
    if not trip:
        raise TripNotFoundError("trip not found")

    normalized_body = to_nullable_string(body)
    if not normalized_body:
        raise TripValidationError("comment body is required")
    if len(normalized_body) > 1200:
        raise TripValidationError("comment body must be 1200 characters or fewer")

    with get_cursor(commit=True) as cur:
        cur.execute(
            """
            INSERT INTO comments (user_id, trip_id, body)
            VALUES (%s, %s, %s)
            RETURNING comment_id, user_id, trip_id, body, created_at
            """,
            (user_id, trip_id, normalized_body),
        )
        created_comment = cur.fetchone()

        if not created_comment:
            raise TripValidationError("failed to create comment")

        cur.execute(
            """
            SELECT name, profile_image_url
            FROM travelers
            WHERE user_id = %s
            LIMIT 1
            """,
            (user_id,),
        )
        author_row = cur.fetchone()

    invalidate_trip_list_cache()

    return {
        "comment_id": int(created_comment["comment_id"]),
        "user_id": int(created_comment["user_id"]),
        "trip_id": int(created_comment["trip_id"]),
        "body": created_comment.get("body") or "",
        "created_at": _as_datetime_iso(created_comment.get("created_at")),
        "user_name": author_row.get("name") if author_row else None,
        "user_profile_image_url": author_row.get("profile_image_url") if author_row else None,
    }

def get_unread_trip_comment_count_by_trip(*, user_id: int) -> dict[int, int]:
    with get_cursor() as cur:
        cur.execute(
            """
            SELECT c.trip_id, COUNT(*) AS unread_count
            FROM comments c
            JOIN trips t ON t.trip_id = c.trip_id
            LEFT JOIN user_comment_read_state rs ON rs.user_id = %s
            WHERE t.owner_user_id = %s
            AND c.user_id <> %s
            AND (rs.last_seen_trip_comment_at IS NULL OR c.created_at > rs.last_seen_trip_comment_at)
            GROUP BY c.trip_id
            """,
            (user_id, user_id, user_id),
        )
        rows = cur.fetchall()

    return {
        int(row["trip_id"]): int(row["unread_count"])
        for row in rows
        if row.get("trip_id") is not None and row.get("unread_count") is not None
    }


def mark_trip_comment_notifications_read(*, user_id: int) -> str | None:

    with get_cursor(commit=True) as cur:
        cur.execute(
            """
            INSERT INTO user_comment_read_state (user_id, last_seen_trip_comment_at)
            VALUES (%s, NOW())
            ON CONFLICT (user_id)
            DO UPDATE SET last_seen_trip_comment_at = EXCLUDED.last_seen_trip_comment_at
            RETURNING last_seen_trip_comment_at
            """,
            (user_id,),
        )
        row = cur.fetchone()

    return _as_datetime_iso(row.get("last_seen_trip_comment_at")) if row else None
