from __future__ import annotations

import argparse
import json
import os
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from psycopg2.extras import execute_values

# Allow running this script directly from /server/scripts.
SERVER_DIR = Path(__file__).resolve().parents[1]
if str(SERVER_DIR) not in sys.path:
    sys.path.insert(0, str(SERVER_DIR))

from db import get_cursor
from services.trip_priority import score_trip_priority


@dataclass
class ScoredTrip:
    trip_id: int
    title: str
    score: float
    tier: str
    breakdown: dict[str, Any]


def ensure_priority_score_column_exists() -> None:
    with get_cursor() as cur:
        cur.execute(
            """
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'trips'
              AND column_name = 'priority_score'
            LIMIT 1
            """
        )
        exists = cur.fetchone() is not None

    if not exists:
        raise RuntimeError(
            "Column public.trips.priority_score does not exist. Add it first, then rerun this script."
        )


def fetch_trips_for_scoring(limit: int | None) -> list[dict[str, Any]]:
    sql = """
        SELECT
            t.trip_id,
            t.thumbnail_url,
            t.title,
            t.description,
            ST_Y(t.geo_location::geometry) AS latitude,
            ST_X(t.geo_location::geometry) AS longitude,
            t.cost,
            COALESCE(activities.activities, '[]'::jsonb) AS activities,
            COALESCE(lodgings.lodgings, '[]'::jsonb) AS lodgings
        FROM trips t
        LEFT JOIN LATERAL (
            SELECT jsonb_agg(
                jsonb_build_object(
                    'title', a.title,
                    'location', a.location,
                    'address', a.address,
                    'thumbnail_url', a.thumbnail_url,
                    'latitude', ST_Y(a.geo_location::geometry),
                    'longitude', ST_X(a.geo_location::geometry),
                    'description', a.description,
                    'cost', a.cost
                )
                ORDER BY a.activity_id
            ) AS activities
            FROM activities a
            WHERE a.trip_id = t.trip_id
        ) activities ON TRUE
        LEFT JOIN LATERAL (
            SELECT jsonb_agg(
                jsonb_build_object(
                    'title', l.title,
                    'address', l.address,
                    'thumbnail_url', l.thumbnail_url,
                    'latitude', ST_Y(l.geo_location::geometry),
                    'longitude', ST_X(l.geo_location::geometry),
                    'description', l.description,
                    'cost', l.cost
                )
                ORDER BY l.lodge_id
            ) AS lodgings
            FROM lodgings l
            WHERE l.trip_id = t.trip_id
        ) lodgings ON TRUE
        ORDER BY t.trip_id
    """

    params: tuple[Any, ...] = ()
    if limit is not None:
        sql += " LIMIT %s"
        params = (limit,)

    with get_cursor() as cur:
        cur.execute(sql, params)
        return list(cur.fetchall())


def compute_scores(trips: list[dict[str, Any]]) -> list[ScoredTrip]:
    scored: list[ScoredTrip] = []

    for trip in trips:
        result = score_trip_priority(trip)
        scored.append(
            ScoredTrip(
                trip_id=int(trip["trip_id"]),
                title=str(trip.get("title") or "Untitled Trip"),
                score=float(result["score"]),
                tier=str(result["tier"]),
                breakdown=result["breakdown"],
            )
        )

    return scored


def update_priority_scores(scored_trips: list[ScoredTrip]) -> int:
    if not scored_trips:
        return 0

    rows = [(item.trip_id, item.score) for item in scored_trips]

    with get_cursor(commit=True) as cur:
        execute_values(
            cur,
            """
            UPDATE trips AS t
            SET priority_score = v.priority_score
            FROM (VALUES %s) AS v(trip_id, priority_score)
            WHERE t.trip_id = v.trip_id
            """,
            rows,
            page_size=500,
        )

    return len(rows)


def summarize(scored_trips: list[ScoredTrip]) -> dict[str, Any]:
    if not scored_trips:
        return {
            "count": 0,
            "avg_score": 0,
            "tiers": {},
        }

    tier_counts: dict[str, int] = {}
    total_score = 0.0
    for item in scored_trips:
        total_score += item.score
        tier_counts[item.tier] = tier_counts.get(item.tier, 0) + 1

    return {
        "count": len(scored_trips),
        "avg_score": round(total_score / len(scored_trips), 2),
        "tiers": tier_counts,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Backfill trips.priority_score using services.trip_priority.score_trip_priority",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Optional max number of trips to process (useful for smoke tests).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Compute and print summary without writing to the database.",
    )
    parser.add_argument(
        "--print-sample",
        type=int,
        default=5,
        help="Number of scored sample rows to print (trip_id/score/tier).",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    ensure_priority_score_column_exists()
    trips = fetch_trips_for_scoring(args.limit)
    scored = compute_scores(trips)

    summary = summarize(scored)
    print(json.dumps({"summary": summary}, indent=2))

    for item in scored:
        print(f"{item.title} | {item.score}")

    sample_count = max(0, args.print_sample)
    if sample_count > 0:
        sample_rows = [
            {"trip_id": item.trip_id, "title": item.title, "score": item.score, "tier": item.tier}
            for item in scored[:sample_count]
        ]
        print(json.dumps({"sample": sample_rows}, indent=2))

    if args.dry_run:
        print("Dry run complete. No database rows were updated.")
        return

    updated = update_priority_scores(scored)
    print(f"Updated priority_score for {updated} trips.")


if __name__ == "__main__":
    # Ensure env loading behavior remains consistent with the server package.
    os.chdir(SERVER_DIR)
    main()
