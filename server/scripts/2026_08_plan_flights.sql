-- One-time migration: add flights to plans.
--
--   psql "$DATABASE_URL" -f server/scripts/2026_08_plan_flights.sql
--
-- plan_flights: user-saved flights within a plans collection. Typically added
-- by pasting a Google Flights link; whatever fields we can parse are
-- pre-filled and the rest can be filled in manually.
--
-- Dates/times are stored as TEXT (not DATE/TIME) so partially-parsed or
-- human-readable values ("Sep 12", "morning") round-trip without validation.

CREATE TABLE IF NOT EXISTS plan_flights (
    flight_id BIGSERIAL PRIMARY KEY,
    owner_user_id INTEGER NOT NULL REFERENCES travelers(user_id) ON DELETE CASCADE,
    collection_name TEXT,
    airline TEXT,
    flight_number TEXT,
    origin_code TEXT,
    destination_code TEXT,
    departure_date TEXT,
    departure_time TEXT,
    price TEXT,
    link_url TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plan_flights_owner
    ON plan_flights (owner_user_id);
