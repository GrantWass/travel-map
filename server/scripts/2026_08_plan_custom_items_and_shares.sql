-- One-time migration: enable custom plan items and shareable plans.
--
--   psql "$DATABASE_URL" -f server/scripts/2026_08_plan_custom_items_and_shares.sql
--
-- plan_custom_items: user-authored plan entries that are not references to
-- existing activities/lodgings (e.g. "Rent a canoe", "Dad's cabin").
--
-- plan_shares: read-only share links for a single collection (collection_name)
-- or the user's entire plans (collection_name IS NULL).

CREATE TABLE IF NOT EXISTS plan_custom_items (
    custom_item_id BIGSERIAL PRIMARY KEY,
    owner_user_id INTEGER NOT NULL REFERENCES travelers(user_id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    notes TEXT,
    address TEXT,
    cost TEXT,
    collection_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plan_custom_items_owner
    ON plan_custom_items (owner_user_id);

CREATE TABLE IF NOT EXISTS plan_shares (
    share_token TEXT PRIMARY KEY,
    owner_user_id INTEGER NOT NULL REFERENCES travelers(user_id) ON DELETE CASCADE,
    collection_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plan_shares_owner
    ON plan_shares (owner_user_id);
