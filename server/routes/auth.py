from __future__ import annotations

import bcrypt
from flask import Blueprint, Response, current_app, jsonify, request, session

from db import get_cursor
from services.auth_service import (
    AUTH_TOKEN_COOKIE_NAME,
    AUTH_TOKEN_TTL_SECONDS,
    create_auth_token,
    get_authenticated_user,
    get_user_by_email,
    to_nullable_string,
)

auth_bp = Blueprint("auth", __name__)


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
        session["user_id"] = user_id
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

        session["user_id"] = user["user_id"]
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

    user = get_authenticated_user(session)
    if not user:
        return jsonify({"authenticated": False}), 401

    return jsonify({"authenticated": True, "user": user}), 200


@auth_bp.route("/logout", methods=["POST", "OPTIONS"])
def logout():
    if request.method == "OPTIONS":
        return ("", 204)

    session.clear()
    response = jsonify({"message": "logged out"})
    response.status_code = 200
    response.delete_cookie(AUTH_TOKEN_COOKIE_NAME, path="/")
    return response
