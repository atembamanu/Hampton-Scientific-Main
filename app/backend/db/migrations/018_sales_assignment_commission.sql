ALTER TABLE quotes ADD COLUMN IF NOT EXISTS assigned_sales_user_id TEXT REFERENCES users(id);
CREATE INDEX IF NOT EXISTS ix_quotes_assigned_sales_user_id ON quotes (assigned_sales_user_id);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS assigned_sales_user_id TEXT REFERENCES users(id);
CREATE INDEX IF NOT EXISTS ix_orders_assigned_sales_user_id ON orders (assigned_sales_user_id);

UPDATE quotes
SET assigned_sales_user_id = quoted_by_user_id
WHERE assigned_sales_user_id IS NULL
  AND quoted_by_user_id IN (SELECT id FROM users WHERE role = 'sales');

UPDATE quotes q
SET assigned_sales_user_id = o.registered_by_user_id
FROM organizations o
WHERE q.assigned_sales_user_id IS NULL
  AND q.organization_id = o.id
  AND o.registered_by_user_id IN (SELECT id FROM users WHERE role = 'sales');

UPDATE orders
SET assigned_sales_user_id = quote.assigned_sales_user_id
FROM quotes quote
WHERE orders.assigned_sales_user_id IS NULL
  AND orders.quote_id = quote.id
  AND quote.assigned_sales_user_id IS NOT NULL;

UPDATE orders o
SET assigned_sales_user_id = org.registered_by_user_id
FROM organizations org
WHERE o.assigned_sales_user_id IS NULL
  AND o.organization_id = org.id
  AND org.registered_by_user_id IN (SELECT id FROM users WHERE role = 'sales');

ALTER TABLE sales_agent_targets ADD COLUMN IF NOT EXISTS commission_rate DOUBLE PRECISION;

UPDATE sales_agent_targets
SET commission_rate = CASE commission_band
    WHEN 'starter' THEN 2
    WHEN 'senior' THEN 8
    WHEN 'standard' THEN 5
    ELSE 1.5
END
WHERE commission_rate IS NULL;
