from __future__ import annotations

from collections.abc import MutableMapping
from typing import Any

from db import get_cursor


def to_nullable_string(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text if text else None


def normalize_user(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "user_id": int(row["user_id"]),
        "name": row.get("name"),
        "email": row.get("email"),
        "bio": row.get("bio"),
        "verified": bool(row.get("verified")),
        "college": row.get("college"),
        "profile_image_url": row.get("profile_image_url"),
    }


def get_user_by_email(email: str) -> dict[str, Any] | None:
    with get_cursor() as cur:
        cur.execute(
            """
            SELECT user_id, name, email, password_hash, bio, verified, college, profile_image_url
            FROM travelers
            WHERE email = %s
            LIMIT 1
            """,
            (email,),
        )
        row = cur.fetchone()

    if not row:
        return None

    return {
        "user_id": int(row["user_id"]),
        "name": row.get("name"),
        "email": row.get("email"),
        "password_hash": row.get("password_hash"),
        "bio": row.get("bio"),
        "verified": bool(row.get("verified")),
        "college": row.get("college"),
        "profile_image_url": row.get("profile_image_url"),
    }


def get_user_by_id(user_id: int) -> dict[str, Any] | None:
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
        row = cur.fetchone()

    if not row:
        return None

    return normalize_user(row)


def get_authenticated_user(session: MutableMapping[str, Any]) -> dict[str, Any] | None:
    session_user_id = session.get("user_id")
    if not isinstance(session_user_id, int):
        return None

    user = get_user_by_id(session_user_id)
    if not user:
        session.clear()
        return None

    return user


def update_profile(*, user_id: int, bio: str | None, college: str | None, profile_image_url: str | None, verified: bool):
    with get_cursor(commit=True) as cur:
        cur.execute(
            """
            UPDATE travelers
            SET bio = %s,
                college = %s,
                profile_image_url = %s,
                verified = %s
            WHERE user_id = %s
            """,
            (bio, college, profile_image_url, verified, user_id),
        )

    return get_user_by_id(user_id)
