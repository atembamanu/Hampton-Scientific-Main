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

-- 3) (RETIRED) Legacy status normalization.
-- This file is re-applied on every backend startup (see db/init_db.py). The
-- original statement below rewrote every 'pending' quote to 'quoted', which in
-- the current ops workflow silently promoted newly submitted / under-review
-- quotes to "preparing quote" after each restart and zeroed the
-- "New quote requests" dashboard tile. 'pending' is now a first-class status,
-- so the normalization must not run again.
--
-- UPDATE quotes SET status = 'quoted' WHERE status IN ('pending', 'approved');

COMMIT;

