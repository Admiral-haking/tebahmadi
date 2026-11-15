CREATE TRIGGER IF NOT EXISTS products_create_default_variant
AFTER INSERT ON products
WHEN NOT EXISTS (SELECT 1 FROM product_variants WHERE product_id = NEW.id)
BEGIN
  INSERT INTO product_variants(id, product_id, title, sku, price_toman, stock_quantity, active)
  VALUES ('default-' || NEW.id, NEW.id, 'پیش‌فرض', NEW.sku, NEW.price_toman, NEW.stock, NEW.active);
END;
