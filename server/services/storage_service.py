from __future__ import annotations

from datetime import datetime, timezone
from io import BytesIO
import uuid

import boto3
from PIL import Image, ImageOps, UnidentifiedImageError
from werkzeug.datastructures import FileStorage

from config import AWS_REGION, S3_BUCKET_NAME

ALLOWED_IMAGE_CONTENT_TYPES = {
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/gif",
}

MAX_IMAGE_LONG_EDGE_PX = 2560
WEBP_QUALITY = 88


class StorageConfigError(RuntimeError):
    pass


class StorageValidationError(ValueError):
    pass


def _build_object_url(key: str) -> str:
    return f"https://{S3_BUCKET_NAME}.s3.{AWS_REGION}.amazonaws.com/{key}"


def _optimize_image_for_web(*, file: FileStorage, content_type: str) -> tuple[BytesIO, str, str]:
    if content_type == "image/gif":
        file.stream.seek(0)
        raw_bytes = BytesIO(file.stream.read())
        raw_bytes.seek(0)
        return raw_bytes, "image/gif", ".gif"

    file.stream.seek(0)

    try:
        with Image.open(file.stream) as source:
            image = ImageOps.exif_transpose(source)

            if image.mode not in ("RGB", "RGBA"):
                image = image.convert("RGBA" if "A" in image.getbands() else "RGB")

            width, height = image.size
            longest_edge = max(width, height)
            if longest_edge > MAX_IMAGE_LONG_EDGE_PX:
                scale = MAX_IMAGE_LONG_EDGE_PX / float(longest_edge)
                resized = (
                    max(1, int(round(width * scale))),
                    max(1, int(round(height * scale))),
                )
                image = image.resize(resized, Image.Resampling.LANCZOS)

            output = BytesIO()

            try:
                image.save(output, format="WEBP", quality=WEBP_QUALITY, method=6)
                output.seek(0)
                return output, "image/webp", ".webp"
            except OSError:
                output = BytesIO()
                if image.mode == "RGBA":
                    image.save(output, format="PNG", optimize=True)
                    output.seek(0)
                    return output, "image/png", ".png"

                image.save(output, format="JPEG", quality=90, optimize=True, progressive=True)
                output.seek(0)
                return output, "image/jpeg", ".jpg"
    except UnidentifiedImageError as error:
        raise StorageValidationError("file is not a valid image") from error


def upload_image_file(*, file: FileStorage, folder: str, owner_user_id: int) -> str:
    if not S3_BUCKET_NAME:
        raise StorageConfigError("S3_BUCKET_NAME is not configured")

    content_type = (file.mimetype or "").lower().strip()
    if content_type not in ALLOWED_IMAGE_CONTENT_TYPES:
        raise StorageValidationError("file must be an image (jpeg, png, webp, or gif)")

    optimized_stream, optimized_content_type, optimized_extension = _optimize_image_for_web(
        file=file,
        content_type=content_type,
    )

    safe_folder = folder.strip("/") or "trips"
    timestamp = datetime.now(tz=timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    key = f"{safe_folder}/{owner_user_id}/{timestamp}-{uuid.uuid4().hex}{optimized_extension}"

    extra_args = {"ContentType": optimized_content_type}

    s3_client = boto3.client("s3", region_name=AWS_REGION)
    optimized_stream.seek(0)
    s3_client.upload_fileobj(optimized_stream, S3_BUCKET_NAME, key, ExtraArgs=extra_args)

    return _build_object_url(key)
