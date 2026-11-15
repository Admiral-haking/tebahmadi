type RefundDatabase = { prepare(sql: string): { bind(...values: unknown[]): { run(): Promise<{ meta?: { changes?: number } }>; first<T>(): Promise<T | null> } } };

export type RefundReservation =
  | { kind: "reserved"; id: string }
  | { kind: "already_refunded"; providerReference: string | null }
  | { kind: "in_progress" };

export async function reserveRefund(db: RefundDatabase, orderId: string): Promise<RefundReservation> {
  const id = crypto.randomUUID();
  await db.prepare(
    "INSERT OR IGNORE INTO refund_operations(id,order_id,status) VALUES(?,?, 'pending')",
  ).bind(id, orderId).run();
  const row = await db.prepare(
    "SELECT id,status,provider_reference FROM refund_operations WHERE order_id=?",
  ).bind(orderId).first<{ id: string; status: string; provider_reference: string | null }>();
  if (!row) throw new Error("refund_reservation_failed");
  if (row.status === "refunded") return { kind: "already_refunded", providerReference: row.provider_reference };
  if (row.id !== id && row.status === "pending") return { kind: "in_progress" };
  const claimed = await db.prepare(
    "UPDATE refund_operations SET status='processing',last_error=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status IN ('pending','failed')",
  ).bind(row.id).run();
  if (!Number(claimed.meta?.changes || 0)) return { kind: "in_progress" };
  return { kind: "reserved", id: row.id };
}

export async function completeRefund(db: RefundDatabase, id: string, providerReference: string | null) {
  await db.prepare(
    "UPDATE refund_operations SET status='refunded',provider_reference=?,last_error=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='processing'",
  ).bind(providerReference, id).run();
}

export async function failRefund(db: RefundDatabase, id: string, error: string) {
  await db.prepare(
    "UPDATE refund_operations SET status='failed',last_error=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='processing'",
  ).bind(error.slice(0, 500), id).run();
}
