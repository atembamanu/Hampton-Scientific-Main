ALTER TABLE orders ADD COLUMN IF NOT EXISTS ordered_at TIMESTAMP;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS dispatched_at TIMESTAMP;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP;

UPDATE orders SET ordered_at = created_at WHERE ordered_at IS NULL;

UPDATE orders
SET dispatched_at = COALESCE(updated_at, created_at)
WHERE dispatched_at IS NULL
  AND status IN ('dispatched', 'out_for_delivery', 'delivered');

UPDATE orders
SET delivered_at = COALESCE(updated_at, created_at)
WHERE delivered_at IS NULL
  AND status = 'delivered';
