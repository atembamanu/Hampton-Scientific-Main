-- The "Preparing quote" step was removed from the quote workflow. Quotes that
-- were sitting in that step are now simply under review. Idempotent.
UPDATE quotes
SET current_handler = 'UNDER_REVIEW'
WHERE current_handler = 'PREPARING_QUOTE';

-- A quote that has been priced but not yet sent is also just under review.
UPDATE quotes
SET status = 'pending', current_handler = 'UNDER_REVIEW'
WHERE status = 'quoted' AND current_handler = 'ADMIN_REVIEW';
