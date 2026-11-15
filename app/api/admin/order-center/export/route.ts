import { env } from "@/lib/runtime";
import { hasAdminRole } from "../../auth";
import { buildOrderFilters, ordersToCsv } from "../../../../../lib/order-operations";

export async function GET(request: Request) {
  if (!await hasAdminRole(request, ["owner", "admin", "manager", "support"])) return Response.json({ error: "دسترسی مجاز نیست" }, { status: 401 });
  const url = new URL(request.url), filters = buildOrderFilters({ status: url.searchParams.get("status") || undefined, shippingStatus: url.searchParams.get("shippingStatus") || undefined, q: url.searchParams.get("q") || undefined, from: url.searchParams.get("from") || undefined, to: url.searchParams.get("to") || undefined }), qualify = (clause: string) => clause.replace(/\bid\b/g, "o.id").replace(/\bcustomer_name\b/g, "o.customer_name").replace(/\bphone\b/g, "o.phone").replace(/\bstatus\b/g, "o.status").replace(/\bshipping_status\b/g, "o.shipping_status").replace(/\bcreated_at\b/g, "o.created_at"), clauses = filters.clauses.map(qualify), values = [...filters.values];
  if (url.searchParams.get("q")?.trim()) { const needle = `%${url.searchParams.get("q")!.trim().slice(0, 80)}%`; clauses.push("(o.tracking_code LIKE ? OR s.tracking_code LIKE ?)"); values.push(needle, needle); }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const rows = await env.DB.prepare(`SELECT o.id,o.customer_name,o.phone,o.address,o.status,o.payment_status,o.shipping_status,o.tracking_code,o.discount_toman,o.shipping_toman,o.subtotal_toman,o.created_at,s.provider AS shipment_provider,s.status AS shipment_status,s.tracking_code AS shipment_tracking_code FROM orders o LEFT JOIN shipments s ON s.order_id=o.id ${where} ORDER BY o.created_at DESC LIMIT 5000`).bind(...values).all();
  return new Response(ordersToCsv(rows.results), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="tab-ahmadi-orders.csv"', "Cache-Control": "no-store" } });
}
