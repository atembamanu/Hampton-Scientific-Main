-- Keep fulfilment/delivery independent of order commercial status
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_status TEXT DEFAULT 'pending';
