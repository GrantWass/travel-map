from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from typing import Any

from flask import has_request_context, request as flask_request
from jose import JWTError, jwt

from config import SECRET_KEY
from db import get_cursor

AUTH_TOKEN_COOKIE_NAME = "travel_map_auth"
AUTH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30
AUTH_TOKEN_ALGORITHM = "HS256"
UNSET = object()


def to_nullable_string(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text if text else None


def normalize_user(row: dict[str, Any]) -> dict[str, Any]:
    completed = row.get("completed_onboarding_tours")
    if isinstance(completed, str):
        try:
            completed = json.loads(completed)
        except (ValueError, TypeError):
            completed = []
    return {
        "user_id": int(row["user_id"]),
        "name": row.get("name"),
        "email": row.get("email"),
        "bio": row.get("bio"),
        "verified": bool(row.get("verified")),
        "college": row.get("college"),
        "profile_image_url": row.get("profile_image_url"),
        "completed_onboarding_tours": completed if isinstance(completed, list) else [],
    }


def get_user_by_email(email: str) -> dict[str, Any] | None:
    with get_cursor() as cur:
        cur.execute(
            """
            SELECT user_id, name, email, password_hash, bio, verified, college, profile_image_url, completed_onboarding_tours
            FROM travelers
            WHERE email = %s
            LIMIT 1
            """,
            (email,),
        )
        row = cur.fetchone()

    if not row:
        return None

    completed = row.get("completed_onboarding_tours")
    if isinstance(completed, str):
        try:
            completed = json.loads(completed)
        except (ValueError, TypeError):
            completed = []
    return {
        "user_id": int(row["user_id"]),
        "name": row.get("name"),
        "email": row.get("email"),
        "password_hash": row.get("password_hash"),
        "bio": row.get("bio"),
        "verified": bool(row.get("verified")),
        "college": row.get("college"),
        "profile_image_url": row.get("profile_image_url"),
        "completed_onboarding_tours": completed if isinstance(completed, list) else [],
    }


def get_user_by_id(user_id: int) -> dict[str, Any] | None:
    with get_cursor() as cur:
        cur.execute(
            """
            SELECT user_id, name, email, bio, verified, college, profile_image_url, completed_onboarding_tours
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


def create_auth_token(user_id: int) -> str:
    expires_at = datetime.now(timezone.utc) + timedelta(seconds=AUTH_TOKEN_TTL_SECONDS)
    return jwt.encode(
        {
            "sub": str(user_id),
            "exp": expires_at,
        },
        SECRET_KEY,
        algorithm=AUTH_TOKEN_ALGORITHM,
    )


def get_user_id_from_auth_token(token: str) -> int | None:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[AUTH_TOKEN_ALGORITHM])
    except JWTError:
        return None

    subject = payload.get("sub")
    if subject is None:
        return None

    try:
        return int(subject)
    except (TypeError, ValueError):
        return None


def extract_bearer_token(value: str | None) -> str | None:
    if not value:
        return None

    prefix = "Bearer "
    if not value.startswith(prefix):
        return None

    token = value[len(prefix):].strip()
    return token or None


def get_authenticated_user() -> dict[str, Any] | None:
    if not has_request_context():
        return None

    auth_header = flask_request.headers.get("Authorization")
    bearer_token = extract_bearer_token(auth_header)
    cookie_token = flask_request.cookies.get(AUTH_TOKEN_COOKIE_NAME)
    token = bearer_token or cookie_token
    if not token:
        return None

    token_user_id = get_user_id_from_auth_token(token)
    if token_user_id is None:
        return None

    user = get_user_by_id(token_user_id)
    if not user:
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


def mark_onboarding_steps_complete(*, user_id: int, step_ids: list[str]) -> dict[str, Any] | None:
    with get_cursor(commit=True) as cur:
        cur.execute(
            "SELECT completed_onboarding_tours FROM travelers WHERE user_id = %s",
            (user_id,),
        )
        row = cur.fetchone()
        if not row:
            return None

        existing = row["completed_onboarding_tours"]
        if isinstance(existing, str):
            try:
                existing = json.loads(existing)
            except (ValueError, TypeError):
                existing = []
        current: list[str] = list(existing) if isinstance(existing, list) else []
        merged = list(dict.fromkeys([*current, *step_ids]))

        cur.execute(
            "UPDATE travelers SET completed_onboarding_tours = %s::jsonb WHERE user_id = %s",
            (json.dumps(merged), user_id),
        )

    return get_user_by_id(user_id)


def update_user_settings(
    *,
    user_id: int,
    name: str | None | object = UNSET,
    bio: str | None | object = UNSET,
    college: str | None | object = UNSET,
    profile_image_url: str | None | object = UNSET,
) -> dict[str, Any] | None:
    assignments: list[str] = []
    values: list[Any] = []

    if name is not UNSET:
        assignments.append("name = %s")
        values.append(name)

    if bio is not UNSET:
        assignments.append("bio = %s")
        values.append(bio)

    if college is not UNSET:
        assignments.append("college = %s")
        values.append(college)

    if profile_image_url is not UNSET:
        assignments.append("profile_image_url = %s")
        values.append(profile_image_url)

    if not assignments:
        return get_user_by_id(user_id)

    values.append(user_id)
    with get_cursor(commit=True) as cur:
        cur.execute(
            f"""
            UPDATE travelers
            SET {", ".join(assignments)}
            WHERE user_id = %s
            """,
            tuple(values),
        )

    return get_user_by_id(user_id)


def search_users(q: str, limit: int = 20) -> list[dict[str, Any]]:
    """Search users by name (case-insensitive). Returns list of dicts with user_id, name, email, profile_image_url."""
    if not q or not str(q).strip():
        return []

    pattern = f"%{str(q).strip()}%"
    with get_cursor() as cur:
        cur.execute(
            """
            SELECT user_id, name, email, profile_image_url, bio
            FROM travelers
            WHERE name ILIKE %s
            ORDER BY name ASC
            LIMIT %s
            """,
            (pattern, limit),
        )
        rows = cur.fetchall()

    results: list[dict[str, Any]] = []
    for r in rows:
        results.append(
            {
                "user_id": int(r["user_id"]),
                "name": r.get("name"),
                "email": r.get("email"),
                "profile_image_url": r.get("profile_image_url"),
                "bio": r.get("bio"),
            }
        )

    return results
