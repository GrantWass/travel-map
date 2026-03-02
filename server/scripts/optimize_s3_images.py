from __future__ import annotations

import argparse
from dataclasses import dataclass

import boto3

from config import AWS_REGION, S3_BUCKET_NAME
from services.storage_service import (
    ALLOWED_IMAGE_CONTENT_TYPES,
    StorageValidationError,
    optimize_image_for_web_bytes,
)


@dataclass
class OptimizeStats:
    scanned: int = 0
    optimized: int = 0
    skipped_non_image: int = 0
    skipped_larger: int = 0
    skipped_failed: int = 0
    bytes_before: int = 0
    bytes_after: int = 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Optimize existing S3 images using the same pipeline as new uploads.",
    )
    parser.add_argument(
        "--prefix",
        default="",
        help="Only process keys under this prefix (example: trips/)",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=0,
        help="Maximum number of objects to process (0 = no limit)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Compute optimizations without writing objects back to S3",
    )
    parser.add_argument(
        "--overwrite-larger",
        action="store_true",
        help="Overwrite even when optimized file is larger than original",
    )
    return parser.parse_args()


def should_optimize_content_type(content_type: str | None) -> bool:
    if not content_type:
        return False

    normalized = content_type.split(";")[0].strip().lower()
    return normalized in ALLOWED_IMAGE_CONTENT_TYPES


def optimize_bucket_images(*, prefix: str, limit: int, dry_run: bool, overwrite_larger: bool) -> OptimizeStats:
    if not S3_BUCKET_NAME:
        raise RuntimeError("S3_BUCKET_NAME is not configured")

    s3 = boto3.client("s3", region_name=AWS_REGION)
    paginator = s3.get_paginator("list_objects_v2")
    pages = paginator.paginate(Bucket=S3_BUCKET_NAME, Prefix=prefix)

    stats = OptimizeStats()

    for page in pages:
        for obj in page.get("Contents", []):
            key = obj["Key"]
            stats.scanned += 1

            if limit > 0 and stats.scanned > limit:
                return stats

            try:
                head = s3.head_object(Bucket=S3_BUCKET_NAME, Key=key)
                content_type = (head.get("ContentType") or "").strip().lower()
                content_length = int(head.get("ContentLength") or 0)

                if not should_optimize_content_type(content_type):
                    stats.skipped_non_image += 1
                    continue

                response = s3.get_object(Bucket=S3_BUCKET_NAME, Key=key)
                body = response["Body"].read()

                optimized_stream, optimized_content_type, _ = optimize_image_for_web_bytes(
                    source_bytes=body,
                    content_type=content_type,
                )
                optimized_bytes = optimized_stream.getvalue()

                optimized_size = len(optimized_bytes)
                if optimized_size > content_length and not overwrite_larger:
                    stats.skipped_larger += 1
                    continue

                stats.bytes_before += content_length
                stats.bytes_after += optimized_size

                if not dry_run:
                    s3.put_object(
                        Bucket=S3_BUCKET_NAME,
                        Key=key,
                        Body=optimized_bytes,
                        ContentType=optimized_content_type,
                        CacheControl="public, max-age=31536000, immutable",
                    )

                stats.optimized += 1
            except StorageValidationError:
                stats.skipped_failed += 1
            except Exception:
                stats.skipped_failed += 1

    return stats


def main() -> None:
    args = parse_args()

    stats = optimize_bucket_images(
        prefix=args.prefix,
        limit=args.limit,
        dry_run=args.dry_run,
        overwrite_larger=args.overwrite_larger,
    )

    saved_bytes = max(0, stats.bytes_before - stats.bytes_after)
    saved_mb = saved_bytes / (1024 * 1024)

    print("S3 image optimization complete")
    print(f"- scanned: {stats.scanned}")
    print(f"- optimized: {stats.optimized}")
    print(f"- skipped_non_image: {stats.skipped_non_image}")
    print(f"- skipped_larger: {stats.skipped_larger}")
    print(f"- skipped_failed: {stats.skipped_failed}")
    print(f"- bytes_before: {stats.bytes_before}")
    print(f"- bytes_after: {stats.bytes_after}")
    print(f"- estimated_saved_mb: {saved_mb:.2f}")


if __name__ == "__main__":
    main()
