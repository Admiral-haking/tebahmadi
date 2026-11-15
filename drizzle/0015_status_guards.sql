-- Additive status guards for columns introduced before their domain constraints
-- existed. Triggers preserve existing rows while preventing invalid future state.
CREATE TRIGGER IF NOT EXISTS orders_payment_status_insert_guard
BEFORE INSERT ON orders
WHEN NEW.payment_status NOT IN ('unpaid','pending','paid','failed','refunded')
BEGIN SELECT RAISE(ABORT, 'invalid order payment status'); END;

CREATE TRIGGER IF NOT EXISTS orders_payment_status_update_guard
BEFORE UPDATE OF payment_status ON orders
WHEN NEW.payment_status NOT IN ('unpaid','pending','paid','failed','refunded')
BEGIN SELECT RAISE(ABORT, 'invalid order payment status'); END;

CREATE TRIGGER IF NOT EXISTS orders_shipping_status_insert_guard
BEFORE INSERT ON orders
WHEN NEW.shipping_status NOT IN ('unquoted','quoted','registered','in_transit','delivered','failed','cancelled')
BEGIN SELECT RAISE(ABORT, 'invalid order shipping status'); END;

CREATE TRIGGER IF NOT EXISTS orders_shipping_status_update_guard
BEFORE UPDATE OF shipping_status ON orders
WHEN NEW.shipping_status NOT IN ('unquoted','quoted','registered','in_transit','delivered','failed','cancelled')
BEGIN SELECT RAISE(ABORT, 'invalid order shipping status'); END;

CREATE TRIGGER IF NOT EXISTS shipments_status_insert_guard
BEFORE INSERT ON shipments
WHEN NEW.status NOT IN ('pending','quoted','registered','in_transit','delivered','failed','cancelled')
BEGIN SELECT RAISE(ABORT, 'invalid shipment status'); END;

CREATE TRIGGER IF NOT EXISTS shipments_status_update_guard
BEFORE UPDATE OF status ON shipments
WHEN NEW.status NOT IN ('pending','quoted','registered','in_transit','delivered','failed','cancelled')
BEGIN SELECT RAISE(ABORT, 'invalid shipment status'); END;
