from __future__ import annotations

from typing import Any, Optional

from db import get_cursor


def create_friend_request(*, requester_id: int, addressee_id: int) -> dict[str, Any] | None:
    if requester_id == addressee_id:
        return None

    with get_cursor(commit=True) as cur:
        cur.execute(
            """
            SELECT id, requester_id, addressee_id, status
            FROM friendships
            WHERE
                (requester_id = %s AND addressee_id = %s)
                OR (requester_id = %s AND addressee_id = %s)
            ORDER BY id DESC
            """,
            (requester_id, addressee_id, addressee_id, requester_id),
        )
        existing_rows = [dict(row) for row in cur.fetchall()]

        # If users are already connected or have a pending request in either direction,
        # do not create another row.
        for existing in existing_rows:
            status = existing.get("status")
            if status in {"accepted", "pending"}:
                return None

        # If only declined rows exist, reuse the most recent row and reopen as pending
        # in the latest request direction.
        if existing_rows:
            most_recent = existing_rows[0]
            cur.execute(
                """
                UPDATE friendships
                SET requester_id = %s, addressee_id = %s, status = 'pending'
                WHERE id = %s
                RETURNING id, requester_id, addressee_id, status
                """,
                (requester_id, addressee_id, most_recent["id"]),
            )
            reopened = cur.fetchone()
            return dict(reopened) if reopened else None

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
    if status not in {"accepted", "declined", "pending"}:
        return None

    with get_cursor(commit=True) as cur:
        cur.execute("SELECT id, requester_id, addressee_id, status FROM friendships WHERE id = %s", (friendship_id,))
        row = cur.fetchone()
        if not row:
            return None
        if row.get("addressee_id") != responder_id:
            return None

        cur.execute("UPDATE friendships SET status = %s WHERE id = %s RETURNING id, requester_id, addressee_id, status", (status, friendship_id))
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
                r.profile_image_url AS requester_profile_image_url,
                r.bio AS requester_bio,
                f.addressee_id,
                a.name AS addressee_name,
                a.profile_image_url AS addressee_profile_image_url,
                a.bio AS addressee_bio,
                f.status
            FROM friendships f
            JOIN travelers r ON r.user_id = f.requester_id
            JOIN travelers a ON a.user_id = f.addressee_id
            WHERE f.requester_id = %s OR f.addressee_id = %s
            """,
            (user_id, user_id),
        )
        rows = [dict(row) for row in cur.fetchall()]

    # Deduplicate accepted friendships by pair (keep newest), and pending requests
    # by direction (keep newest). If a pair is already accepted, hide pending rows.
    accepted_by_pair: dict[tuple[int, int], dict[str, Any]] = {}
    pending_by_direction: dict[tuple[int, int], dict[str, Any]] = {}

    for row in rows:
        entry = dict(row)
        entry["requester_id"] = int(entry["requester_id"])
        entry["addressee_id"] = int(entry["addressee_id"])
        row_id = int(entry.get("id") or 0)
        status = entry.get("status")

        pair_key = (
            min(entry["requester_id"], entry["addressee_id"]),
            max(entry["requester_id"], entry["addressee_id"]),
        )

        if status == "accepted":
            current = accepted_by_pair.get(pair_key)
            if current is None or row_id > int(current.get("id") or 0):
                accepted_by_pair[pair_key] = entry
            continue

        if status == "pending":
            direction_key = (entry["requester_id"], entry["addressee_id"])
            current = pending_by_direction.get(direction_key)
            if current is None or row_id > int(current.get("id") or 0):
                pending_by_direction[direction_key] = entry

    accepted = list(accepted_by_pair.values())

    for pending in pending_by_direction.values():
        pair_key = (
            min(pending["requester_id"], pending["addressee_id"]),
            max(pending["requester_id"], pending["addressee_id"]),
        )
        if pair_key in accepted_by_pair:
            continue

        if pending["requester_id"] == user_id:
            outgoing.append(pending)
        else:
            incoming.append(pending)

    return {"incoming": incoming, "outgoing": outgoing, "accepted": accepted}
