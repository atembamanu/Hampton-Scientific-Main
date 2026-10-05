ALTER TABLE product_categories ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;
UPDATE product_categories SET updated_at = COALESCE(updated_at, created_at, NOW());
