
from __future__ import annotations

import uuid
from typing import Any, Optional

import boto3
from flask import current_app

from config import AWS_REGION, CLIENT_APP_URLS
from services.friendship_service import create_friend_request as svc_create_friend_request, respond_friend_request as svc_respond_friend_request
from db import get_cursor


def create_sms_invite(*, inviter_id: int, phone_number: str) -> dict[str, Any]:
    token = uuid.uuid4().hex
    with get_cursor(commit=True) as cur:
        cur.execute(
            """
            INSERT INTO sms_invites (inviter_id, phone_number, invite_token, status)
            VALUES (%s, %s, %s, 'sent')
            RETURNING id, inviter_id, phone_number, invite_token, status, claimed_user_id, created_at
            """,
            (inviter_id, phone_number, token),
        )
        row = cur.fetchone()

    result: dict[str, Any] = dict(row) if row else {}

    # attempt to send SMS via AWS SNS
    try:
        # TODO: make this to our domain
        base_url = CLIENT_APP_URLS[0] if CLIENT_APP_URLS else None
        invite_link = f"{base_url.rstrip('/')}/signup?invite={token}" if base_url else token
        message = f"A friend invited you to join Travel Map. Join here: {invite_link}"

        sns = boto3.client("sns", region_name=AWS_REGION)
        attributes: dict[str, dict[str, str]] = {
            "AWS.SNS.SMS.SMSType": {"DataType": "String", "StringValue": "Transactional"}
        }
        resp = sns.publish(PhoneNumber=phone_number, Message=message, MessageAttributes=attributes)
        message_id = resp.get("MessageId")
        current_app.logger.info(f"Sent SMS invite (id: {message_id}) to {phone_number} for inviter_id {inviter_id}")
    except Exception as exc:  # on failure, mark status failed and log
        try:
            with get_cursor(commit=True) as cur:
                cur.execute("UPDATE sms_invites SET status = %s WHERE id = %s", ("failed", result.get("id")))
        except Exception:
            current_app.logger.exception("Failed to mark sms_invite as failed")
        current_app.logger.exception("Failed to send SMS invite")

    return result


def create_link_invite(*, inviter_id: int) -> dict[str, Any]:
    token = uuid.uuid4().hex
    with get_cursor(commit=True) as cur:
        cur.execute(
            """
            INSERT INTO sms_invites (inviter_id, phone_number, invite_token, status)
            VALUES (%s, %s, %s, 'sent')
            RETURNING id, inviter_id, phone_number, invite_token, status, claimed_user_id, created_at
            """,
            (inviter_id, "", token),
        )
        row = cur.fetchone()

    return dict(row) if row else {}


def claim_sms_invite(*, invite_token: str, claimed_user_id: int) -> Optional[dict[str, Any]]:
    with get_cursor(commit=True) as cur:
        cur.execute("SELECT id, status FROM sms_invites WHERE invite_token = %s LIMIT 1", (invite_token,))
        found = cur.fetchone()
        if not found:
            return None
        if found.get("status") != "sent":
            return None

        cur.execute(
            """
            UPDATE sms_invites
            SET status = 'claimed', claimed_user_id = %s
            WHERE id = %s
            RETURNING id, inviter_id, phone_number, invite_token, status, claimed_user_id, created_at
            """,
            (claimed_user_id, found["id"]),
        )
        updated = cur.fetchone() if cur.rowcount else None

    if not updated:
        return None

    # After successfully claiming the invite, create a friendship between inviter and claimed user.
    try:
        inviter_id = int(updated.get("inviter_id")) if updated.get("inviter_id") is not None else None
        if inviter_id and claimed_user_id and inviter_id != claimed_user_id:
            # Create the friend request (will return existing if present)
            friendship = svc_create_friend_request(requester_id=inviter_id, addressee_id=claimed_user_id)
            if friendship and friendship.get("id"):
                # As the claimed user is the addressee, accept the request to establish friendship
                try:
                    svc_respond_friend_request(friendship_id=int(friendship["id"]), responder_id=claimed_user_id, status="accepted")
                except Exception:
                    current_app.logger.exception("Failed to accept friendship after invite claim")
    except Exception:
        current_app.logger.exception("Failed to create friendship after invite claim")

    return dict(updated)
