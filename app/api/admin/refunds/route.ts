import { env } from "@/lib/runtime";
import { getAdminIdentity, sameOrigin } from "../auth";
import { recordAudit } from "../login/audit";
import { csvEscape } from "../../../../lib/order-operations";

const roles = ["owner", "admin", "manager"];

export async function GET(request: Request) {
  const actor = await getAdminIdentity(request);
  if (!actor || !roles.includes(actor.role)) return Response.json({ error: "دسترسی مجاز نیست" }, { status: 401 });
  const status = new URL(request.url).searchParams.get("status");
  const statusFilter = ["pending", "processing", "refunded", "failed"].includes(String(status)) ? String(status) : null;
  const rows = statusFilter
    ? await env.DB.prepare("SELECT r.*,o.status order_status,o.payment_status,o.subtotal_toman,o.customer_name,o.phone FROM refund_operations r JOIN orders o ON o.id=r.order_id WHERE r.status=? ORDER BY r.updated_at DESC LIMIT 200").bind(statusFilter).all<any>()
    : await env.DB.prepare("SELECT r.*,o.status order_status,o.payment_status,o.subtotal_toman,o.customer_name,o.phone FROM refund_operations r JOIN orders o ON o.id=r.order_id ORDER BY r.updated_at DESC LIMIT 200").all<any>();
  if (new URL(request.url).searchParams.get("format") === "csv") {
    const header = ["شناسه عملیات", "شناسه سفارش", "نام مشتری", "موبایل", "مبلغ", "وضعیت refund", "وضعیت سفارش", "وضعیت پرداخت", "مرجع provider", "خطای آخر", "به‌روزرسانی"];
    const lines = rows.results.map((row: any) => [row.id, row.order_id, row.customer_name, row.phone, row.subtotal_toman, row.status, row.order_status, row.payment_status, row.provider_reference, row.last_error, row.updated_at].map(csvEscape).join(","));
    return new Response("\uFEFF" + header.map(csvEscape).join(",") + "\r\n" + lines.join("\r\n") + "\r\n", { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="tab-ahmadi-refunds.csv"', "Cache-Control": "no-store" } });
  }
  return Response.json({ refunds: rows.results }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const actor = await getAdminIdentity(request);
  if (!actor || !roles.includes(actor.role)) return Response.json({ error: "دسترسی مجاز نیست" }, { status: 401 });
  if (!sameOrigin(request)) return Response.json({ error: "مبدأ درخواست معتبر نیست" }, { status: 403 });
  let body: any;
  try { body = await request.json(); } catch { return Response.json({ error: "درخواست نامعتبر است" }, { status: 400 }); }
  const orderId = String(body.orderId || "").slice(0, 80);
  if (!orderId) return Response.json({ error: "شناسه سفارش لازم است" }, { status: 400 });
  const row = await env.DB.prepare(
    "SELECT r.id,r.status,r.provider_reference,o.status order_status,o.payment_status,o.subtotal_toman FROM refund_operations r JOIN orders o ON o.id=r.order_id WHERE r.order_id=?",
  ).bind(orderId).first<any>();
  if (!row) return Response.json({ error: "عملیات refund پیدا نشد" }, { status: 404 });
  if (row.status !== "refunded") return Response.json({ error: "فقط refund تأییدشده توسط provider قابل تطبیق است" }, { status: 409 });
  try {
    await env.DB.prepare("UPDATE orders SET status='refunded',payment_status='refunded' WHERE id=? AND status NOT IN ('cancelled','refunded')").bind(orderId).run();
    const financial = await env.DB.prepare("INSERT OR IGNORE INTO financial_entries(id,kind,category,amount_toman,description,reference,order_id,created_by) VALUES(?,'expense','عودت وجه',?,?,?, ?,?)").bind(crypto.randomUUID(), row.subtotal_toman, "تطبیق عودت سفارش " + orderId, row.provider_reference || row.id, orderId, actor.id).run();
    if (!Number(financial.meta?.changes || 0)) return Response.json({ ok: true, idempotent: true });
    await env.DB.prepare("INSERT INTO order_events(id,order_id,status,note) VALUES(?,?,?,?)").bind(crypto.randomUUID(), orderId, "refund_reconciled", "سند مالی عودت با وضعیت provider تطبیق داده شد").run();
    await recordAudit(request, "refund.reconcile", "order", orderId, JSON.stringify({ operationId: row.id, providerReference: row.provider_reference }));
    return Response.json({ ok: true, idempotent: row.payment_status === "refunded" && row.order_status === "refunded" });
  } catch {
    return Response.json({ error: "تطبیق refund انجام نشد" }, { status: 503 });
  }
}
