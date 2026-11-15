ALTER TABLE orders ADD COLUMN shipping_method TEXT NOT NULL DEFAULT 'post_pishtaz';
ALTER TABLE orders ADD COLUMN shipping_status TEXT NOT NULL DEFAULT 'unquoted';
ALTER TABLE orders ADD COLUMN tracking_code TEXT;
ALTER TABLE orders ADD COLUMN payment_authority TEXT;
ALTER TABLE orders ADD COLUMN payment_verified_at TEXT;
CREATE TABLE IF NOT EXISTS shipping_methods (
  id TEXT PRIMARY KEY NOT NULL,
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'manual',
  price_toman INTEGER NOT NULL DEFAULT 0,
  free_over_toman INTEGER,
  eta_days INTEGER NOT NULL DEFAULT 3,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS shipments (
  id TEXT PRIMARY KEY NOT NULL,
  order_id TEXT NOT NULL UNIQUE REFERENCES orders(id),
  provider TEXT NOT NULL,
  provider_order_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  tracking_code TEXT,
  quote_toman INTEGER NOT NULL DEFAULT 0,
  payload_json TEXT NOT NULL DEFAULT '{}',
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS shipments_status_idx ON shipments(provider,status,updated_at);
INSERT OR IGNORE INTO shipping_methods(id,code,title,provider,price_toman,eta_days,active) VALUES('post-pishtaz','post_pishtaz','پست پیشتاز','tapin',0,3,1);
