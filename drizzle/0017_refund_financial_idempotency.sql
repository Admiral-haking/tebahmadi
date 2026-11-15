CREATE UNIQUE INDEX IF NOT EXISTS finance_refund_order_unique
ON financial_entries(order_id)
WHERE category = 'عودت وجه' AND kind = 'expense' AND order_id IS NOT NULL;
