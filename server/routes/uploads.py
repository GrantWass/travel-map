from __future__ import annotations

from flask import Blueprint, current_app, jsonify, request, session

from services.auth_service import get_authenticated_user
from services.storage_service import StorageConfigError, StorageValidationError, upload_image_file

uploads_bp = Blueprint("uploads", __name__)


@uploads_bp.route("/uploads/images", methods=["POST", "OPTIONS"])
def upload_image_route():
    if request.method == "OPTIONS":
        return ("", 204)

    user = get_authenticated_user(session)
    if not user:
        return jsonify({"error": "authentication required"}), 401

    uploaded_file = request.files.get("file")
    if not uploaded_file or not uploaded_file.filename:
        return jsonify({"error": "file is required"}), 400

    folder = str(request.form.get("folder") or "trips")

    try:
        image_url = upload_image_file(file=uploaded_file, folder=folder, owner_user_id=user["user_id"])
        return jsonify({"url": image_url}), 201
    except StorageValidationError as error:
        return jsonify({"error": str(error)}), 400
    except StorageConfigError as error:
        current_app.logger.exception("Image upload config error")
        return jsonify({"error": str(error)}), 500
    except Exception as error:
        current_app.logger.exception("Image upload failed")
        return jsonify({"error": f"image upload failed: {str(error)}"}), 500
