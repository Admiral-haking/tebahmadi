CREATE TABLE IF NOT EXISTS product_variants (
  id TEXT PRIMARY KEY NOT NULL,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'پیش‌فرض',
  sku TEXT NOT NULL DEFAULT '',
  barcode TEXT NOT NULL DEFAULT '',
  attributes_json TEXT NOT NULL DEFAULT '{}',
  price_toman INTEGER NOT NULL CHECK (price_toman >= 0),
  compare_at_toman INTEGER,
  stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  reserved_quantity INTEGER NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0),
  low_stock_threshold INTEGER NOT NULL DEFAULT 5 CHECK (low_stock_threshold >= 0),
  weight_grams INTEGER NOT NULL DEFAULT 0 CHECK (weight_grams >= 0),
  active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (reserved_quantity <= stock_quantity)
);
CREATE UNIQUE INDEX IF NOT EXISTS product_variants_sku_unique ON product_variants(sku) WHERE sku <> '';
CREATE UNIQUE INDEX IF NOT EXISTS product_variants_barcode_unique ON product_variants(barcode) WHERE barcode <> '';
CREATE INDEX IF NOT EXISTS product_variants_product_active_idx ON product_variants(product_id, active, sort_order);
CREATE TABLE IF NOT EXISTS product_variant_options (
  variant_id TEXT NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  option_name TEXT NOT NULL,
  option_value TEXT NOT NULL,
  PRIMARY KEY (variant_id, option_name)
);
CREATE TABLE IF NOT EXISTS shipment_events (
  id TEXT PRIMARY KEY NOT NULL,
  shipment_id TEXT NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  provider_status TEXT,
  provider_code TEXT,
  tracking_code TEXT,
  message TEXT NOT NULL DEFAULT '',
  raw_safe_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS shipment_events_shipment_created_idx ON shipment_events(shipment_id, created_at);
ALTER TABLE shipments ADD COLUMN method TEXT NOT NULL DEFAULT 'post_pishtaz';
ALTER TABLE shipments ADD COLUMN provider_invoice_id TEXT;
ALTER TABLE shipments ADD COLUMN weight_grams INTEGER NOT NULL DEFAULT 0;
ALTER TABLE shipments ADD COLUMN package_weight_grams INTEGER NOT NULL DEFAULT 0;
ALTER TABLE shipments ADD COLUMN recipient_snapshot_json TEXT NOT NULL DEFAULT '{}';
ALTER TABLE shipments ADD COLUMN provider_response_json TEXT NOT NULL DEFAULT '{}';
ALTER TABLE shipments ADD COLUMN provider_status_code TEXT;
ALTER TABLE shipments ADD COLUMN idempotency_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS shipments_idempotency_key_unique ON shipments(idempotency_key) WHERE idempotency_key IS NOT NULL;
ALTER TABLE inventory_movements ADD COLUMN variant_id TEXT REFERENCES product_variants(id);
ALTER TABLE inventory_movements ADD COLUMN operation TEXT NOT NULL DEFAULT 'adjustment';
ALTER TABLE inventory_movements ADD COLUMN requested_delta INTEGER NOT NULL DEFAULT 0;
ALTER TABLE inventory_movements ADD COLUMN applied_delta INTEGER NOT NULL DEFAULT 0;
ALTER TABLE inventory_movements ADD COLUMN shortfall INTEGER NOT NULL DEFAULT 0;
ALTER TABLE inventory_movements ADD COLUMN before_quantity INTEGER;
ALTER TABLE inventory_movements ADD COLUMN after_quantity INTEGER;
ALTER TABLE inventory_movements ADD COLUMN operation_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS inventory_movements_operation_key_unique ON inventory_movements(operation_key) WHERE operation_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS inventory_movements_variant_created_idx ON inventory_movements(variant_id, created_at);
INSERT OR IGNORE INTO product_variants(id, product_id, title, sku, price_toman, stock_quantity, active)
  SELECT 'default-' || id, id, 'پیش‌فرض', sku, price_toman, stock, active FROM products;
UPDATE inventory_movements
SET variant_id = 'default-' || product_id,
    requested_delta = delta,
    applied_delta = delta,
    operation = CASE WHEN delta < 0 THEN 'deduct' ELSE 'adjustment' END
WHERE variant_id IS NULL;
