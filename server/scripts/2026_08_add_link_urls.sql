-- One-time migration: add website links to stops and custom plan items.
--
--   psql "$DATABASE_URL" -f server/scripts/2026_08_add_link_urls.sql
--

ALTER TABLE activities ADD COLUMN IF NOT EXISTS link_url TEXT;
ALTER TABLE lodgings ADD COLUMN IF NOT EXISTS link_url TEXT;
ALTER TABLE plan_custom_items ADD COLUMN IF NOT EXISTS link_url TEXT;
