-- Add website and default document terms to site_settings.
-- Safe to rerun.

BEGIN;

ALTER TABLE site_settings
  ADD COLUMN IF NOT EXISTS website TEXT;

ALTER TABLE site_settings
  ADD COLUMN IF NOT EXISTS default_quote_validity_days INTEGER DEFAULT 7;

ALTER TABLE site_settings
  ADD COLUMN IF NOT EXISTS default_invoice_due_days INTEGER DEFAULT 14;

COMMIT;

