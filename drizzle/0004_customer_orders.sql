CREATE TABLE IF NOT EXISTS orders_v2 (
  id TEXT PRIMARY KEY NOT NULL,
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT NOT NULL,
  postal_code TEXT,
  items_json TEXT NOT NULL,
  subtotal_toman INTEGER NOT NULL CHECK (subtotal_toman >= 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','processing','shipped','cancelled','refunded')),
  payment_reference TEXT,
  customer_id TEXT REFERENCES customers(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO orders_v2 (id,customer_name,phone,address,postal_code,items_json,subtotal_toman,status,payment_reference,created_at)
SELECT id,customer_name,phone,address,postal_code,items_json,subtotal_toman,status,payment_reference,created_at FROM orders;
DROP TABLE orders;
ALTER TABLE orders_v2 RENAME TO orders;
CREATE INDEX IF NOT EXISTS orders_created_at_idx ON orders(created_at);
