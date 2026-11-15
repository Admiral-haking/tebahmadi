CREATE TABLE IF NOT EXISTS refund_operations (
  id TEXT PRIMARY KEY NOT NULL,
  order_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','processing','refunded','failed')),
  provider_reference TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS refund_operations_order_unique ON refund_operations(order_id);
CREATE INDEX IF NOT EXISTS refund_operations_status_idx ON refund_operations(status, updated_at);
