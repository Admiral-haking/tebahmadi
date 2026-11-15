export type OrderFilterInput = { status?: string; shippingStatus?: string; q?: string; from?: string; to?: string };

export function csvEscape(value: unknown): string {
  const text = String(value ?? "");
  if (/^[=+\-@]/.test(text)) return `'${text}`;
  return /[",\n\r]/.test(text) ? `="${text.replace(/"/g, '""')}"` : text;
}

export function buildOrderFilters(input: OrderFilterInput) {
  const clauses: string[] = [], values: string[] = [];
  if (input.status && ["pending", "paid", "processing", "shipped", "cancelled", "refunded"].includes(input.status)) { clauses.push("status = ?"); values.push(input.status); }
  if (input.shippingStatus && ["unquoted", "quoted", "registered", "in_transit", "delivered", "failed", "cancelled"].includes(input.shippingStatus)) { clauses.push("shipping_status = ?"); values.push(input.shippingStatus); }
  if (input.from && input.to && /^\d{4}-\d{2}-\d{2}$/.test(input.from) && /^\d{4}-\d{2}-\d{2}$/.test(input.to) && input.from <= input.to) { clauses.push("date(created_at) BETWEEN date(?) AND date(?)"); values.push(input.from, input.to); }
  if (input.q?.trim()) { clauses.push("(id LIKE ? OR customer_name LIKE ? OR phone LIKE ?)"); const q = `%${input.q.trim().slice(0, 80)}%`; values.push(q, q, q); }
  return { clauses, values };
}

export function summarizeOrders(rows: Array<{ status?: string; payment_status?: string; shipping_status?: string; subtotal_toman?: number }>) {
  return rows.reduce((out, row) => {
    out.count++;
    if (row.payment_status === "paid") out.revenueToman += Number(row.subtotal_toman || 0);
    if (row.payment_status === "paid") out.paid++;
    if (row.payment_status === "paid" && ["unquoted", "quoted"].includes(String(row.shipping_status))) out.readyToShip++;
    if (row.shipping_status === "registered" || row.status === "shipped") out.shipped++;
    if (row.status === "cancelled") out.cancelled++;
    return out;
  }, { count: 0, revenueToman: 0, paid: 0, readyToShip: 0, shipped: 0, cancelled: 0 });
}

const transitions: Record<string, string[]> = { pending: ["paid", "cancelled"], paid: ["processing", "cancelled", "refunded"], processing: ["shipped", "cancelled", "refunded"], shipped: ["refunded"], cancelled: [], refunded: [] };
export function canTransitionOrder(from: string, to: string) { return from === to || !!transitions[from]?.includes(to); }

export function ordersToCsv(rows: any[]) {
  const header = ["شناسه سفارش", "نام مشتری", "موبایل", "آدرس", "وضعیت", "وضعیت پرداخت", "وضعیت ارسال", "provider ارسال", "وضعیت shipment", "کد رهگیری", "تخفیف", "هزینه ارسال", "مبلغ نهایی", "تاریخ"];
  const lines = rows.map(row => [row.id, row.customer_name, row.phone, row.address, row.status, row.payment_status, row.shipping_status, row.shipment_provider, row.shipment_status, row.tracking_code || row.shipment_tracking_code, row.discount_toman || 0, row.shipping_toman || 0, row.subtotal_toman, row.created_at].map(csvEscape).join(","));
  return "\uFEFF" + header.map(csvEscape).join(",") + "\r\n" + lines.join("\r\n") + "\r\n";
}
