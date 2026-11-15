CREATE TRIGGER IF NOT EXISTS orders_fulfillment_payment_update_guard
BEFORE UPDATE OF payment_status ON orders
WHEN NEW.status IN ('processing','shipped') AND NEW.payment_status <> 'paid'
BEGIN
  SELECT RAISE(ABORT,'fulfillment requires paid order');
END;
