-- One-time migration: dated itineraries for named plan collections.
--
--   psql "$DATABASE_URL" -f server/scripts/2026_08_plan_itinerary_items.sql

CREATE TABLE IF NOT EXISTS plan_itinerary_items (
    plan_itinerary_item_id BIGSERIAL PRIMARY KEY,
    owner_user_id INTEGER NOT NULL REFERENCES travelers(user_id) ON DELETE CASCADE,
    collection_name TEXT NOT NULL,
    day_date DATE,
    schedule_type TEXT NOT NULL DEFAULT 'time',
    start_time TIME,
    position INTEGER NOT NULL DEFAULT 0,
    source_type TEXT,
    source_id INTEGER,
    title TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT plan_itinerary_source_type CHECK (
        source_type IS NULL OR source_type IN ('activity', 'lodging', 'custom', 'flight')
    ),
    CONSTRAINT plan_itinerary_schedule_type CHECK (
        schedule_type IN ('time', 'night')
    ),
    CONSTRAINT plan_itinerary_source_required CHECK (
        (source_type IS NOT NULL AND source_id IS NOT NULL)
        OR NULLIF(TRIM(title), '') IS NOT NULL
    )
);

CREATE INDEX IF NOT EXISTS idx_plan_itinerary_owner_collection
    ON plan_itinerary_items (owner_user_id, collection_name);

ALTER TABLE plan_itinerary_items
    ADD COLUMN IF NOT EXISTS schedule_type TEXT NOT NULL DEFAULT 'time';
ALTER TABLE plan_itinerary_items
    ADD COLUMN IF NOT EXISTS start_time TIME;
