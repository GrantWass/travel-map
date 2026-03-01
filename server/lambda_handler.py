from __future__ import annotations

import awsgi

from app import create_app

flask_app = create_app()


def handler(event, context):
    return awsgi.response(flask_app, event, context)
