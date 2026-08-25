-- One-time migration: make plan custom items first-class stops with the same
-- properties as trip activities/lodgings.
--
--   psql "$DATABASE_URL" -f server/scripts/2026_08_custom_item_trip_fields.sql
--

ALTER TABLE plan_custom_items ADD COLUMN IF NOT EXISTS item_type TEXT NOT NULL DEFAULT 'activity';
ALTER TABLE plan_custom_items ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE plan_custom_items ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE plan_custom_items ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
ALTER TABLE plan_custom_items ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;
