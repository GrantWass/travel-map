from __future__ import annotations

from collections.abc import MutableMapping
from datetime import datetime, timedelta, timezone
from typing import Any

from flask import has_request_context, request as flask_request
from jose import JWTError, jwt

from config import SECRET_KEY
from db import get_cursor

AUTH_TOKEN_COOKIE_NAME = "travel_map_auth"
AUTH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30
AUTH_TOKEN_ALGORITHM = "HS256"


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


def get_authenticated_user(session: MutableMapping[str, Any]) -> dict[str, Any] | None:
    session_user_id = session.get("user_id")
    if isinstance(session_user_id, int):
        user = get_user_by_id(session_user_id)
        if user:
            return user
        session.clear()

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

    session["user_id"] = token_user_id

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
