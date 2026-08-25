-- One-time migration: optional per-trip itineraries (assign activities /
-- freeform entries to days).
--
--   psql "$DATABASE_URL" -f server/scripts/2026_08_itinerary_items.sql
--
-- itinerary_items:
--   day_date NULL = unscheduled idea; non-NULL = assigned to that day.
--   position orders entries within the same day.
--   Exactly one of activity_id / title must be set.

CREATE TABLE IF NOT EXISTS itinerary_items (
    itinerary_item_id BIGSERIAL PRIMARY KEY,
    trip_id INTEGER NOT NULL REFERENCES trips(trip_id) ON DELETE CASCADE,
    day_date DATE,
    position INTEGER NOT NULL DEFAULT 0,
    activity_id INTEGER REFERENCES activities(activity_id) ON DELETE CASCADE,
    title TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT itinerary_items_source_required CHECK (
        activity_id IS NOT NULL OR NULLIF(TRIM(title), '') IS NOT NULL
    )
);

CREATE INDEX IF NOT EXISTS idx_itinerary_items_trip
    ON itinerary_items (trip_id);

CREATE INDEX IF NOT EXISTS idx_itinerary_items_activity
    ON itinerary_items (activity_id);
