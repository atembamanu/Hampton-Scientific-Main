-- Ordered gallery of product images. The first entry is the primary image
-- shown in the admin products table and catalogue cards.
-- Safe to rerun.

ALTER TABLE products ADD COLUMN IF NOT EXISTS images JSON;

UPDATE products
SET images = CASE
  WHEN image_url IS NOT NULL AND btrim(image_url) <> '' THEN json_build_array(image_url)
  ELSE '[]'::json
END
WHERE images IS NULL;
