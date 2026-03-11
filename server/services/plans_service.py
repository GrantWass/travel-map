from __future__ import annotations

from typing import Any

from db import get_cursor


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

    collection_names_from_items = {r["collection_name"] for r in real_rows if r["collection_name"]}
    collection_names_from_anchors = {r["collection_name"] for r in anchor_rows if r["collection_name"]}
    collections = sorted(collection_names_from_items | collection_names_from_anchors)

    return {
        "saved_activity_ids": saved_activity_ids,
        "saved_lodging_ids": saved_lodging_ids,
        "saved_items": saved_items,
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
