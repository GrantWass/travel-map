from __future__ import annotations

from datetime import date
from typing import Any

from db import get_cursor


class ItineraryForbiddenError(PermissionError):
    pass


def _parse_day_date(value: Any) -> str | None:
    if value is None or value == "":
        return None
    try:
        return date.fromisoformat(str(value)).isoformat()
    except ValueError:
        raise ValueError("day_date must be an ISO date (YYYY-MM-DD)")


def _parse_optional_text(value: Any, *, max_length: int = 2000) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    if len(text) > max_length:
        raise ValueError(f"text fields must be at most {max_length} characters")
    return text


def _user_can_edit_trip(cur, *, trip_id: int, user_id: int) -> bool:
    # Only the trip creator may modify its itinerary — collaborators get
    # read-only access so they cannot restructure someone else's plan.
    cur.execute(
        """
        SELECT EXISTS (
            SELECT 1 FROM trips
            WHERE trip_id = %s AND owner_user_id = %s
        ) AS can_edit
        """,
        (trip_id, user_id),
    )
    row = cur.fetchone()
    return bool(row and row.get("can_edit"))


def list_itinerary(trip_id: int) -> list[dict[str, Any]]:
    with get_cursor() as cur:
        cur.execute(
            """
            SELECT itinerary_item_id, trip_id, day_date::text AS day_date,
                   position, activity_id, title, notes
            FROM itinerary_items
            WHERE trip_id = %s
            ORDER BY day_date ASC NULLS LAST, position ASC, itinerary_item_id ASC
            """,
            (trip_id,),
        )
        rows = cur.fetchall()

    return [
        {
            "itinerary_item_id": int(row["itinerary_item_id"]),
            "trip_id": int(row["trip_id"]),
            "day_date": row.get("day_date"),
            "position": int(row["position"] or 0),
            "activity_id": int(row["activity_id"]) if row.get("activity_id") is not None else None,
            "title": row.get("title"),
            "notes": row.get("notes"),
        }
        for row in rows
    ]


def replace_itinerary(*, trip_id: int, user_id: int, items: Any) -> list[dict[str, Any]]:
    if items is None or not isinstance(items, list):
        raise ValueError("items must be a list")

    parsed: list[dict[str, Any]] = []
    seen_activity_ids: set[int] = set()
    for raw in items:
        if not isinstance(raw, dict):
            raise ValueError("each itinerary item must be an object")

        day_date = _parse_day_date(raw.get("day_date"))
        notes = _parse_optional_text(raw.get("notes"))
        title = _parse_optional_text(raw.get("title"), max_length=300)

        activity_id_raw = raw.get("activity_id")
        activity_id: int | None = None
        if activity_id_raw is not None and str(activity_id_raw).strip() != "":
            try:
                activity_id = int(str(activity_id_raw))
            except ValueError:
                raise ValueError("activity_id must be a valid integer")
            if activity_id <= 0:
                raise ValueError("activity_id must be greater than zero")
            if activity_id in seen_activity_ids:
                raise ValueError("each activity may only appear once in the itinerary")
            seen_activity_ids.add(activity_id)

        if activity_id is None and title is None:
            raise ValueError("itinerary items need either an activity_id or a title")

        parsed.append(
            {
                "day_date": day_date,
                "activity_id": activity_id,
                "title": title,
                "notes": notes,
            }
        )

    with get_cursor(commit=True) as cur:
        if not _user_can_edit_trip(cur, trip_id=trip_id, user_id=user_id):
            raise ItineraryForbiddenError("you do not have permission to edit this itinerary")

        # Validate referenced activities belong to this trip.
        for entry in parsed:
            if entry["activity_id"] is not None:
                cur.execute(
                    "SELECT 1 FROM activities WHERE activity_id = %s AND trip_id = %s",
                    (entry["activity_id"], trip_id),
                )
                if cur.fetchone() is None:
                    raise ValueError("one or more activities do not belong to this trip")

        cur.execute("DELETE FROM itinerary_items WHERE trip_id = %s", (trip_id,))

        # Position is the per-day ordering index in the order provided.
        position_by_day: dict[str | None, int] = {}
        for entry in parsed:
            day_key = entry["day_date"]
            next_position = position_by_day.get(day_key, 0)
            position_by_day[day_key] = next_position + 1
            cur.execute(
                """
                INSERT INTO itinerary_items (trip_id, day_date, position, activity_id, title, notes)
                VALUES (%s, %s, %s, %s, %s, %s)
                """,
                (
                    trip_id,
                    entry["day_date"],
                    next_position,
                    entry["activity_id"],
                    entry["title"],
                    entry["notes"],
                ),
            )

    return list_itinerary(trip_id)
