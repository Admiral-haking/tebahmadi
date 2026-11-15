ALTER TABLE orders ADD COLUMN customer_id TEXT REFERENCES customers(id);
CREATE TABLE IF NOT EXISTS order_events (
  id TEXT PRIMARY KEY NOT NULL,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS order_events_order_idx ON order_events(order_id, created_at);
