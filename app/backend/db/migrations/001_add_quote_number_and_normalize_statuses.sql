-- Adds quote_number (Quote Reference) and normalizes quote statuses.
-- Run this against your Postgres DB (inside container or locally).

BEGIN;

-- 1) Quote Reference column
ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS quote_number TEXT;

-- If you want it enforced as unique, add the index (safe if rerun).
CREATE UNIQUE INDEX IF NOT EXISTS uq_quotes_quote_number ON quotes (quote_number);

-- 2) Backfill quote_number for existing quotes
-- Assign sequential QUO-YYYY-000001 based on created_at order.
WITH ordered AS (
  SELECT
    id,
    created_at,
    ROW_NUMBER() OVER (ORDER BY created_at ASC, id ASC) AS rn
  FROM quotes
  WHERE quote_number IS NULL OR quote_number = ''
),
year_prefix AS (
  SELECT
    o.id,
    'QUO-' || EXTRACT(YEAR FROM o.created_at)::INT || '-' || LPAD(o.rn::TEXT, 6, '0') AS new_quote_number
  FROM ordered o
)
UPDATE quotes q
SET quote_number = y.new_quote_number
FROM year_prefix y
WHERE q.id = y.id;

-- 3) Normalize legacy quote statuses to only: quoted, invoiced
UPDATE quotes
SET status = 'quoted'
WHERE status IN ('pending', 'approved');

-- Optional: if you ever stored other legacy statuses, also map them.
-- UPDATE quotes SET status = 'quoted' WHERE status NOT IN ('quoted','invoiced');

COMMIT;

