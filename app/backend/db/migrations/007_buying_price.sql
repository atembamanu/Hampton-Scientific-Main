-- Buying price (admin-only cost) on products and quote line items

ALTER TABLE products ADD COLUMN IF NOT EXISTS buying_price DOUBLE PRECISION DEFAULT 0;

ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS buying_price DOUBLE PRECISION;

ALTER TABLE modified_quote_items ADD COLUMN IF NOT EXISTS buying_price DOUBLE PRECISION;

ALTER TABLE order_items ADD COLUMN IF NOT EXISTS buying_price DOUBLE PRECISION;

-- Default buying price to 70% of selling price where missing (rough estimate for legacy rows)
UPDATE products
SET buying_price = ROUND((price * 0.7)::numeric, 2)
WHERE (buying_price IS NULL OR buying_price = 0) AND price > 0;
