-- Invoices have a single open state, "awaiting_payment". Older rows used
-- "pending" (app default) or "unpaid" (ORM default) interchangeably, so fold
-- both into the canonical value. Idempotent: safe to re-run on every startup.
-- NOTE: the migration runner splits this file on semicolons, so keep comments
-- free of them.
UPDATE invoices
SET status = 'awaiting_payment'
WHERE status IS NULL OR lower(status) IN ('pending', 'unpaid', '');
