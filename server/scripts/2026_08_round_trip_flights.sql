-- Add structured round-trip itinerary fields while retaining legacy columns.
ALTER TABLE plan_flights
    ADD COLUMN IF NOT EXISTS outbound_date TEXT,
    ADD COLUMN IF NOT EXISTS return_date TEXT,
    ADD COLUMN IF NOT EXISTS outbound_legs JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS return_legs JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS price_minor INTEGER,
    ADD COLUMN IF NOT EXISTS currency TEXT;

UPDATE plan_flights
SET outbound_date = COALESCE(outbound_date, departure_date),
    currency = COALESCE(currency, CASE WHEN price IS NOT NULL THEN 'USD' END),
    price_minor = COALESCE(
        price_minor,
        CASE WHEN price ~ '^\d+(\.\d{1,2})?$' THEN ROUND(price::numeric * 100)::integer END
    )
WHERE outbound_date IS NULL OR currency IS NULL OR price_minor IS NULL;
