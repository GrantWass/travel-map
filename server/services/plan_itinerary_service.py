from __future__ import annotations

from datetime import date
from typing import Any

from db import get_cursor


SOURCE_TYPES = {"activity", "lodging", "custom", "flight"}


def _parse_day(value: Any) -> str | None:
    if value is None or value == "":
        return None
    try:
        return date.fromisoformat(str(value)).isoformat()
    except ValueError as error:
        raise ValueError("day_date must be an ISO date (YYYY-MM-DD)") from error


def _collection_exists(cur, user_id: int, collection_name: str) -> bool:
    cur.execute(
        """
        SELECT EXISTS (
            SELECT 1 FROM saved_plan_items
            WHERE user_id = %s AND collection_name = %s
        ) AS exists
        """,
        (user_id, collection_name),
    )
    row = cur.fetchone()
    return bool(row and row.get("exists"))


def _source_belongs_to_collection(
    cur, user_id: int, collection_name: str, source_type: str, source_id: int
) -> bool:
    if source_type in ("activity", "lodging"):
        cur.execute(
            """
            SELECT 1 FROM saved_plan_items
            WHERE user_id = %s AND collection_name = %s
              AND item_type = %s AND item_id = %s
            """,
            (user_id, collection_name, source_type, source_id),
        )
    elif source_type == "custom":
        cur.execute(
            """
            SELECT 1 FROM plan_custom_items
            WHERE owner_user_id = %s AND collection_name = %s AND custom_item_id = %s
            """,
            (user_id, collection_name, source_id),
        )
    else:
        cur.execute(
            """
            SELECT 1 FROM plan_flights
            WHERE owner_user_id = %s AND collection_name = %s AND flight_id = %s
            """,
            (user_id, collection_name, source_id),
        )
    return cur.fetchone() is not None


def list_plan_itinerary(user_id: int, collection_name: str) -> list[dict[str, Any]]:
    with get_cursor() as cur:
        cur.execute(
            """
            SELECT plan_itinerary_item_id, day_date::text AS day_date, position,
                   source_type, source_id, title
            FROM plan_itinerary_items
            WHERE owner_user_id = %s AND collection_name = %s
            ORDER BY day_date ASC NULLS LAST, position ASC, plan_itinerary_item_id ASC
            """,
            (user_id, collection_name),
        )
        return [dict(row) for row in cur.fetchall()]


def replace_plan_itinerary(
    user_id: int, collection_name: str, items: Any
) -> list[dict[str, Any]]:
    if not isinstance(items, list):
        raise ValueError("items must be a list")

    parsed: list[dict[str, Any]] = []
    seen_sources: set[tuple[str, int]] = set()
    for raw in items:
        if not isinstance(raw, dict):
            raise ValueError("each itinerary item must be an object")
        source_type = raw.get("source_type") or None
        source_id_raw = raw.get("source_id")
        source_id = int(source_id_raw) if source_id_raw not in (None, "") else None
        title = str(raw.get("title") or "").strip()[:300] or None
        if source_type is not None and source_type not in SOURCE_TYPES:
            raise ValueError("invalid source_type")
        if source_type is not None:
            if source_id is None or source_id <= 0:
                raise ValueError("source_id must be greater than zero")
            source_key = (source_type, source_id)
            if source_key in seen_sources:
                raise ValueError("each plan item may only appear once")
            seen_sources.add(source_key)
        elif title is None:
            raise ValueError("freeform itinerary items require a title")
        parsed.append({
            "day_date": _parse_day(raw.get("day_date")),
            "source_type": source_type,
            "source_id": source_id,
            "title": title,
        })

    with get_cursor(commit=True) as cur:
        if not _collection_exists(cur, user_id, collection_name):
            raise LookupError("plan not found")
        for item in parsed:
            if item["source_type"] and not _source_belongs_to_collection(
                cur, user_id, collection_name, item["source_type"], item["source_id"]
            ):
                raise ValueError("one or more items do not belong to this plan")

        cur.execute(
            "DELETE FROM plan_itinerary_items WHERE owner_user_id = %s AND collection_name = %s",
            (user_id, collection_name),
        )
        positions: dict[str | None, int] = {}
        for item in parsed:
            day = item["day_date"]
            position = positions.get(day, 0)
            positions[day] = position + 1
            cur.execute(
                """
                INSERT INTO plan_itinerary_items
                    (owner_user_id, collection_name, day_date, position, source_type, source_id, title)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                """,
                (user_id, collection_name, day, position, item["source_type"], item["source_id"], item["title"]),
            )

    return list_plan_itinerary(user_id, collection_name)
