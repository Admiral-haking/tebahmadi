CREATE TRIGGER IF NOT EXISTS return_requests_timeline_after_update
AFTER UPDATE OF status ON return_requests
WHEN OLD.status <> NEW.status
BEGIN
  INSERT INTO order_events (id, order_id, status, note)
  SELECT lower(hex(randomblob(16))), NEW.order_id, 'return_' || NEW.status,
         'وضعیت مرجوعی تغییر کرد: ' || NEW.status;
END;
