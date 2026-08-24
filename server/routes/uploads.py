from __future__ import annotations

from flask import Blueprint, jsonify, request

from services.auth_service import get_authenticated_user
from services.storage_service import StorageValidationError, upload_image_file

uploads_bp = Blueprint("uploads", __name__)


@uploads_bp.route("/uploads/images", methods=["POST"])
def upload_image_route():
    user = get_authenticated_user()
    if not user:
        return jsonify({"error": "authentication required"}), 401

    uploaded_file = request.files.get("file")
    if not uploaded_file or not uploaded_file.filename:
        return jsonify({"error": "file is required"}), 400

    folder = str(request.form.get("folder") or "trips")

    try:
        image_url = upload_image_file(file=uploaded_file, folder=folder, owner_user_id=user["user_id"])
    except StorageValidationError as error:
        return jsonify({"error": str(error)}), 400
    return jsonify({"url": image_url}), 201
