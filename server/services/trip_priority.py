from __future__ import annotations

from decimal import Decimal
import re
from typing import Any

from services.auth_service import to_nullable_string

# Priority scoring weights are intentionally explicit so product tuning is easy.
# The total is normalized to 100 points.
TRIP_PRIORITY_BASE_POINTS = {
    "image": 7.0,
    "coordinates": 7.0,
    "title": 2.0,
    "description_words": 12.0,
    "cost": 2.0,
}
TRIP_PRIORITY_ITEM_POINTS = {
    "count": 16.0,
    "average_item_completeness": 29.0,
    "item_description_words": 10.0,
}
TRIP_PRIORITY_COVERAGE_POINTS = {
    "image_coverage": 7.5,
    "coordinate_coverage": 7.5,
}
TRIP_PRIORITY_ITEM_COUNT_CAP = 6


def _as_float(value: Any) -> float | None:
    if value is None:
        return None
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, (int, float)):
        return float(value)
    text = str(value).strip()
    if not text:
        return None
    try:
        return float(text)
    except ValueError:
        return None


def _word_count(value: Any) -> int:
    text = to_nullable_string(value)
    if not text:
        return 0
    return len(re.findall(r"[A-Za-z0-9']+", text))


def _has_non_empty_text(value: Any) -> bool:
    text = to_nullable_string(value)
    return bool(text and text.strip())


def _has_coordinates(latitude: Any, longitude: Any) -> bool:
    return _as_float(latitude) is not None and _as_float(longitude) is not None


def score_trip_priority(trip: dict[str, Any]) -> dict[str, Any]:
    """
    Compute a 0-100 trip priority score with a detailed breakdown.

    Scoring philosophy:
    - A high-priority trip should look complete and useful at a glance.
    - Activities and lodgings are treated as one pooled collection of "items"
    - Description quality uses fractional per-word scoring with caps to reward
      progressively richer writeups without letting verbosity dominate.
    """

    # Gather trip-level signals.
    trip_has_image = _has_non_empty_text(trip.get("thumbnail_url"))
    trip_has_coordinates = _has_coordinates(trip.get("latitude"), trip.get("longitude"))
    trip_title_words = _word_count(trip.get("title"))
    trip_description_words = _word_count(trip.get("description"))
    trip_has_cost = _as_float(trip.get("cost")) is not None

    # Activities/lodgings are intentionally pooled together to enforce equal weight.
    items: list[dict[str, Any]] = []
    for activity in trip.get("activities") or []:
        if isinstance(activity, dict):
            items.append(
                {
                    "kind": "activity",
                    "title": activity.get("title"),
                    "place_text": activity.get("location") or activity.get("address"),
                    "thumbnail_url": activity.get("thumbnail_url"),
                    "latitude": activity.get("latitude"),
                    "longitude": activity.get("longitude"),
                    "description": activity.get("description"),
                    "cost": activity.get("cost"),
                }
            )
    for lodging in trip.get("lodgings") or []:
        if isinstance(lodging, dict):
            items.append(
                {
                    "kind": "lodging",
                    "title": lodging.get("title"),
                    "place_text": lodging.get("address"),
                    "thumbnail_url": lodging.get("thumbnail_url"),
                    "latitude": lodging.get("latitude"),
                    "longitude": lodging.get("longitude"),
                    "description": lodging.get("description"),
                    "cost": lodging.get("cost"),
                }
            )

    # ----------------------------
    # Section A: Trip base (30 pts)
    # ----------------------------
    # Description uses 0.08 points per word, capped by configured max points.
    base_image_points = TRIP_PRIORITY_BASE_POINTS["image"] if trip_has_image else 0.0
    base_coordinate_points = TRIP_PRIORITY_BASE_POINTS["coordinates"] if trip_has_coordinates else 0.0
    base_title_points = TRIP_PRIORITY_BASE_POINTS["title"] if trip_title_words >= 2 else 0.0
    base_description_points = min(float(trip_description_words) * 0.08, TRIP_PRIORITY_BASE_POINTS["description_words"])
    base_cost_points = TRIP_PRIORITY_BASE_POINTS["cost"] if trip_has_cost else 0.0
    base_total = base_image_points + base_coordinate_points + base_title_points + base_description_points + base_cost_points

    # ----------------------------------------
    # Section B: Combined item quality (55 pts)
    # ----------------------------------------
    item_count = len(items)

    # Count score: linear reward up to a capped total item count.
    # This keeps activity/lodging weighting pooled and symmetric.
    item_count_points = min(float(item_count), float(TRIP_PRIORITY_ITEM_COUNT_CAP)) * (
        TRIP_PRIORITY_ITEM_POINTS["count"] / float(TRIP_PRIORITY_ITEM_COUNT_CAP)
    )

    # Per-item completeness:
    # We score each item out of 10 and then take the average so quality matters
    # more than sheer quantity once the count cap is reached.
    #
    # Breakdown per item (10 max):
    # - title present:                 1.5
    # - place text present:            1.5
    # - image present:                 2.5
    # - coordinates present:           2.5
    # - cost present:                  1.0
    # - description words (0.04/word): 1.0 max at 25+ words
    item_completeness_raw_scores: list[float] = []
    item_description_words_total = 0
    image_positive_count = 1 if trip_has_image else 0
    coordinate_positive_count = 1 if trip_has_coordinates else 0

    for item in items:
        has_title = _has_non_empty_text(item.get("title"))
        has_place_text = _has_non_empty_text(item.get("place_text"))
        has_image = _has_non_empty_text(item.get("thumbnail_url"))
        has_coords = _has_coordinates(item.get("latitude"), item.get("longitude"))
        has_cost = _as_float(item.get("cost")) is not None
        description_words = _word_count(item.get("description"))
        item_description_words_total += description_words

        if has_image:
            image_positive_count += 1
        if has_coords:
            coordinate_positive_count += 1

        item_description_points = min(float(description_words) * 0.04, 1.0)
        raw_item_score = (
            (1.5 if has_title else 0.0)
            + (1.5 if has_place_text else 0.0)
            + (2.5 if has_image else 0.0)
            + (2.5 if has_coords else 0.0)
            + (1.0 if has_cost else 0.0)
            + item_description_points
        )
        item_completeness_raw_scores.append(raw_item_score)

    if item_completeness_raw_scores:
        avg_item_raw_score = sum(item_completeness_raw_scores) / len(item_completeness_raw_scores)
    else:
        avg_item_raw_score = 0.0

    item_average_completeness_points = (
        (avg_item_raw_score / 10.0) * TRIP_PRIORITY_ITEM_POINTS["average_item_completeness"]
    )

    # Combined item descriptions use fractional points too: ~0.033 points/word,
    # capped by configured max points (about 300 words for full points).
    item_description_points = min(float(item_description_words_total) * 0.033, TRIP_PRIORITY_ITEM_POINTS["item_description_words"])

    item_total = item_count_points + item_average_completeness_points + item_description_points

    # ----------------------------------
    # Section C: Coverage quality (15 pts)
    # ----------------------------------
    # Coverage evaluates consistency across the whole trip package (trip card +
    # pooled items). This rewards complete portfolios where most entries include
    # media and mappable coordinates.
    coverage_denominator = 1 + item_count
    image_coverage_ratio = image_positive_count / coverage_denominator
    coordinate_coverage_ratio = coordinate_positive_count / coverage_denominator

    coverage_image_points = image_coverage_ratio * TRIP_PRIORITY_COVERAGE_POINTS["image_coverage"]
    coverage_coordinate_points = coordinate_coverage_ratio * TRIP_PRIORITY_COVERAGE_POINTS["coordinate_coverage"]
    coverage_total = coverage_image_points + coverage_coordinate_points

    raw_total = base_total + item_total + coverage_total
    score = max(0.0, min(100.0, raw_total))

    # Tiering defines priority bucket while keeping score numeric for ranking.
    if score >= 80.0 and item_count >= 3 and image_coverage_ratio >= 0.70 and coordinate_coverage_ratio >= 0.70:
        tier = "great"
    elif score >= 60.0:
        tier = "good"
    else:
        tier = "basic"

    return {
        "score": round(score, 2),
        "tier": tier,
        "breakdown": {
            "base": {
                "total": round(base_total, 2),
                "max": 30.0,
                "trip_image_points": round(base_image_points, 2),
                "trip_coordinate_points": round(base_coordinate_points, 2),
                "trip_title_points": round(base_title_points, 2),
                "trip_description_points": round(base_description_points, 2),
                "trip_description_words": trip_description_words,
                "trip_cost_points": round(base_cost_points, 2),
            },
            "items": {
                "total": round(item_total, 2),
                "max": 55.0,
                "combined_item_count": item_count,
                "combined_item_count_points": round(item_count_points, 2),
                "avg_item_raw_score_out_of_10": round(avg_item_raw_score, 2),
                "avg_item_completeness_points": round(item_average_completeness_points, 2),
                "combined_item_description_words": item_description_words_total,
                "combined_item_description_points": round(item_description_points, 2),
            },
            "coverage": {
                "total": round(coverage_total, 2),
                "max": 15.0,
                "image_coverage_ratio": round(image_coverage_ratio, 4),
                "image_coverage_points": round(coverage_image_points, 2),
                "coordinate_coverage_ratio": round(coordinate_coverage_ratio, 4),
                "coordinate_coverage_points": round(coverage_coordinate_points, 2),
            },
        },
    }
