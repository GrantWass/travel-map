from __future__ import annotations

from typing import Any

from db import get_cursor


def _row_to_plans(row: dict) -> dict[str, Any]:
    return {
        "saved_activity_ids": list(row["saved_activity_ids"] or []),
        "saved_lodging_ids": list(row["saved_lodging_ids"] or []),
    }


def get_user_plans(user_id: int) -> dict[str, Any]:
    with get_cursor() as cur:
        cur.execute(
            "SELECT saved_activity_ids, saved_lodging_ids FROM travelers WHERE user_id = %s",
            (user_id,),
        )
        row = cur.fetchone()

    if row is None:
        return {"saved_activity_ids": [], "saved_lodging_ids": []}

    return _row_to_plans(row)


def toggle_saved_activity(user_id: int, activity_id: int) -> dict[str, Any]:
    with get_cursor(commit=True) as cur:
        cur.execute(
            """
            UPDATE travelers
            SET saved_activity_ids =
                CASE WHEN %s = ANY(saved_activity_ids)
                     THEN array_remove(saved_activity_ids, %s)
                     ELSE array_append(saved_activity_ids, %s)
                END
            WHERE user_id = %s
            RETURNING saved_activity_ids, saved_lodging_ids
            """,
            (activity_id, activity_id, activity_id, user_id),
        )
        row = cur.fetchone()

    if row is None:
        return get_user_plans(user_id)

    return _row_to_plans(row)


def toggle_saved_lodging(user_id: int, lodge_id: int) -> dict[str, Any]:
    with get_cursor(commit=True) as cur:
        cur.execute(
            """
            UPDATE travelers
            SET saved_lodging_ids =
                CASE WHEN %s = ANY(saved_lodging_ids)
                     THEN array_remove(saved_lodging_ids, %s)
                     ELSE array_append(saved_lodging_ids, %s)
                END
            WHERE user_id = %s
            RETURNING saved_activity_ids, saved_lodging_ids
            """,
            (lodge_id, lodge_id, lodge_id, user_id),
        )
        row = cur.fetchone()

    if row is None:
        return get_user_plans(user_id)

    return _row_to_plans(row)
