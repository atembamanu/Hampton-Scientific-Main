-- Admin operations: assignment, quote messages, activity, shipments

ALTER TABLE quotes ADD COLUMN IF NOT EXISTS assigned_admin_id TEXT REFERENCES users(id);

CREATE TABLE IF NOT EXISTS quote_messages (
  id TEXT PRIMARY KEY,
  quote_id TEXT NOT NULL REFERENCES quotes(id),
  sender_id TEXT REFERENCES users(id),
  sender_role TEXT NOT NULL,
  sender_name TEXT,
  body TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_quote_messages_quote_id ON quote_messages (quote_id);
CREATE INDEX IF NOT EXISTS ix_quote_messages_created_at ON quote_messages (created_at);

CREATE TABLE IF NOT EXISTS activity_events (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  actor_id TEXT REFERENCES users(id),
  actor_name TEXT,
  actor_role TEXT,
  summary TEXT NOT NULL,
  field_name TEXT,
  previous_value TEXT,
  new_value TEXT,
  is_customer_visible BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_activity_events_entity ON activity_events (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS ix_activity_events_created_at ON activity_events (created_at);

CREATE TABLE IF NOT EXISTS shipments (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  status TEXT DEFAULT 'processing',
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_shipments_order_id ON shipments (order_id);

CREATE TABLE IF NOT EXISTS shipment_items (
  id TEXT PRIMARY KEY,
  shipment_id TEXT NOT NULL REFERENCES shipments(id),
  order_item_id TEXT REFERENCES order_items(id),
  product_id TEXT,
  product_name TEXT NOT NULL,
  quantity INTEGER DEFAULT 1
);
CREATE INDEX IF NOT EXISTS ix_shipment_items_shipment_id ON shipment_items (shipment_id);
