from __future__ import annotations

import bcrypt
import requests
from flask import Blueprint, Response, current_app, jsonify, request

from config import SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL
from db import get_cursor
from services.auth_service import (
    AUTH_TOKEN_COOKIE_NAME,
    AUTH_TOKEN_TTL_SECONDS,
    _get_uuid_from_supabase_token,
    create_auth_token,
    extract_bearer_token,
    get_authenticated_user,
    get_user_by_email,
    link_user_to_supabase,
    to_nullable_string,
)

auth_bp = Blueprint("auth", __name__)


def _create_supabase_user_for_legacy_login(*, email: str, password: str) -> str | None:
    """Create user in Supabase Auth and return UUID, or None if unavailable/failed."""
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        return None

    url = f"{SUPABASE_URL.rstrip('/')}/auth/v1/admin/users"
    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "email": email,
        "password": password,
        "email_confirm": True,
    }

    response = requests.post(url, headers=headers, json=payload, timeout=8)
    if not response.ok:
        return None

    data = response.json() if response.content else {}
    user_id = data.get("id") if isinstance(data, dict) else None
    return user_id if isinstance(user_id, str) and user_id else None


def attach_auth_cookie(response: Response, auth_token: str) -> None:
    response.set_cookie(
        AUTH_TOKEN_COOKIE_NAME,
        auth_token,
        max_age=AUTH_TOKEN_TTL_SECONDS,
        httponly=True,
        secure=True,
        samesite="Lax",
        path="/",
    )


@auth_bp.route("/create-user", methods=["POST", "OPTIONS"])
def create_user():
    if request.method == "OPTIONS":
        return ("", 204)

    try:
        payload = request.get_json(silent=True) or request.form
        email = (payload.get("email") or "").strip().lower()
        password = payload.get("password") or ""
        name = to_nullable_string(payload.get("name")) or email.split("@")[0]

        if not email or not password:
            return jsonify({"error": "email and password are required"}), 400
        if len(password) < 8:
            return jsonify({"error": "password must be at least 8 characters"}), 400

        # If a Supabase JWT is present, password auth is handled by Supabase —
        # only a name/email are needed to create the travelers profile row.
        bearer_token = extract_bearer_token(request.headers.get("Authorization"))
        supabase_uuid = _get_uuid_from_supabase_token(bearer_token) if bearer_token else None

        if supabase_uuid:
            # Supabase already authenticated this user — just create the travelers row.
            with get_cursor(commit=True) as cur:
                cur.execute("SELECT user_id FROM travelers WHERE email = %s", (email,))
                if cur.fetchone():
                    return jsonify({"error": "user already exists"}), 409

                cur.execute(
                    """
                    INSERT INTO travelers (name, email, password_hash, verified, supabase_uuid)
                    VALUES (%s, %s, NULL, FALSE, %s)
                    RETURNING user_id
                    """,
                    (name, email, supabase_uuid),
                )
                created = cur.fetchone()

            if not created:
                return jsonify({"error": "failed to create user"}), 500

            user_id = int(created["user_id"])
            # Return a legacy token too for any in-flight non-Supabase clients
            auth_token = create_auth_token(user_id)
            response = jsonify({"message": "user created", "user_id": user_id, "email": email, "auth_token": auth_token})
            response.status_code = 201
            return response

        password_hash = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

        with get_cursor(commit=True) as cur:
            cur.execute("SELECT user_id FROM travelers WHERE email = %s", (email,))
            if cur.fetchone():
                return jsonify({"error": "user already exists"}), 409

            cur.execute(
                """
                INSERT INTO travelers (name, email, password_hash, verified)
                VALUES (%s, %s, %s, FALSE)
                RETURNING user_id
                """,
                (name, email, password_hash),
            )
            created = cur.fetchone()

        if not created:
            return jsonify({"error": "failed to create user"}), 500

        user_id = int(created["user_id"])
        auth_token = create_auth_token(user_id)

        response = jsonify({"message": "user created", "user_id": user_id, "email": email, "auth_token": auth_token})
        response.status_code = 201
        attach_auth_cookie(response, auth_token)
        return response
    except Exception as error:
        current_app.logger.exception("Create user failed")
        return jsonify({"error": f"create user failed: {str(error)}"}), 500


@auth_bp.route("/login", methods=["POST", "OPTIONS"])
def login_user():
    if request.method == "OPTIONS":
        return ("", 204)

    try:
        payload = request.get_json(silent=True) or request.form
        email = (payload.get("email") or "").strip().lower()
        password = payload.get("password") or ""

        if not email or not password:
            return jsonify({"error": "email and password are required"}), 400

        user = get_user_by_email(email)
        if not user:
            return jsonify({"error": "invalid email or password"}), 401

        password_hash = user.get("password_hash") or ""
        password_valid = bool(password_hash) and bcrypt.checkpw(
            password.encode("utf-8"),
            str(password_hash).encode("utf-8"),
        )
        if not password_valid:
            return jsonify({"error": "invalid email or password"}), 401

        # Lazy migration: if this is a legacy-only user, create/link Supabase auth.
        if not user.get("supabase_uuid"):
            try:
                supabase_uuid = _create_supabase_user_for_legacy_login(email=email, password=password)
                if supabase_uuid:
                    link_user_to_supabase(user_id=int(user["user_id"]), supabase_uuid=supabase_uuid, clear_password_hash=True)
                    user["supabase_uuid"] = supabase_uuid
                    user["password_hash"] = None
            except Exception:
                current_app.logger.exception("Supabase lazy migration failed during login")

        auth_token = create_auth_token(user["user_id"])

        response = jsonify(
            {
                "message": "logged in",
                "auth_token": auth_token,
                "user": {
                    "user_id": user["user_id"],
                    "name": user.get("name"),
                    "email": user.get("email"),
                    "bio": user.get("bio"),
                    "verified": bool(user.get("verified")),
                    "college": user.get("college"),
                    "profile_image_url": user.get("profile_image_url"),
                    "completed_onboarding_tours": user.get("completed_onboarding_tours") or [],
                },
            }
        )
        response.status_code = 200
        attach_auth_cookie(response, auth_token)
        return response
    except Exception as error:
        current_app.logger.exception("Login failed")
        return jsonify({"error": f"login failed: {str(error)}"}), 500


@auth_bp.route("/me", methods=["GET", "OPTIONS"])
def me():
    if request.method == "OPTIONS":
        return ("", 204)

    user = get_authenticated_user()
    if not user:
        return jsonify({"authenticated": False}), 401

    return jsonify({"authenticated": True, "user": user}), 200


@auth_bp.route("/logout", methods=["POST", "OPTIONS"])
def logout():
    if request.method == "OPTIONS":
        return ("", 204)

    response = jsonify({"message": "logged out"})
    response.status_code = 200
    response.delete_cookie(AUTH_TOKEN_COOKIE_NAME, path="/")
    return response
