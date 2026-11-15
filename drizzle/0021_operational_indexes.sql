CREATE INDEX IF NOT EXISTS orders_phone_created_idx ON orders(phone,created_at);
CREATE INDEX IF NOT EXISTS orders_tracking_idx ON orders(tracking_code);
CREATE INDEX IF NOT EXISTS orders_payment_status_idx ON orders(payment_status,status,created_at);
CREATE INDEX IF NOT EXISTS shipments_tracking_idx ON shipments(tracking_code);
CREATE INDEX IF NOT EXISTS promotion_products_product_idx ON promotion_products(product_id,promotion_id);
CREATE INDEX IF NOT EXISTS promotion_redemptions_customer_idx ON promotion_redemptions(promotion_id,customer_id,created_at);
CREATE INDEX IF NOT EXISTS inventory_movements_reference_idx ON inventory_movements(reference,created_at);
