from __future__ import annotations

from typing import Any, Optional

from db import get_cursor


def create_friend_request(*, requester_id: int, addressee_id: int) -> dict[str, Any] | None:
    if requester_id == addressee_id:
        return None

    with get_cursor(commit=True) as cur:
        cur.execute(
            "SELECT id, requester_id, addressee_id, status FROM friendships WHERE requester_id = %s AND addressee_id = %s",
            (requester_id, addressee_id),
        )
        existing = cur.fetchone()
        if existing:
            return dict(existing)

        cur.execute(
            """
            INSERT INTO friendships (requester_id, addressee_id, status)
            VALUES (%s, %s, 'pending')
            RETURNING id, requester_id, addressee_id, status
            """,
            (requester_id, addressee_id),
        )
        row = cur.fetchone()
        return dict(row) if row else None


def respond_friend_request(*, friendship_id: int, responder_id: int, status: str) -> Optional[dict[str, Any]]:
    if status not in {"accepted", "pending"}:
        return None

    with get_cursor(commit=True) as cur:
        cur.execute("SELECT id, requester_id, addressee_id, status FROM friendships WHERE id = %s", (friendship_id,))
        row = cur.fetchone()
        if not row:
            return None
        if row.get("addressee_id") != responder_id:
            return None

        cur.execute("UPDATE friendships SET status = %s WHERE id = %s RETURNING id, requester_id, addressee_id, status, created_at", (status, friendship_id))
        updated = cur.fetchone()
        return dict(updated) if updated else None


def list_friendships(*, user_id: int) -> dict[str, list[dict[str, Any]]]:
    """Return friendships grouped by status for the given user.

    result keys: incoming, outgoing, accepted
    """
    incoming: list[dict] = []
    outgoing: list[dict] = []
    accepted: list[dict] = []

    with get_cursor() as cur:
        cur.execute(
            """
            SELECT
                f.id,
                f.requester_id,
                r.name AS requester_name,
                f.addressee_id,
                a.name AS addressee_name,
                f.status
            FROM friendships f
            JOIN travelers r ON r.user_id = f.requester_id
            JOIN travelers a ON a.user_id = f.addressee_id
            WHERE f.requester_id = %s OR f.addressee_id = %s
            """,
            (user_id, user_id),
        )
        for row in cur.fetchall():
            entry = dict(row)
            # normalize ints
            entry["requester_id"] = int(entry["requester_id"])
            entry["addressee_id"] = int(entry["addressee_id"])
            if entry["status"] == "accepted":
                accepted.append(entry)
            elif entry["requester_id"] == user_id:
                outgoing.append(entry)
            else:
                incoming.append(entry)

    return {"incoming": incoming, "outgoing": outgoing, "accepted": accepted}
