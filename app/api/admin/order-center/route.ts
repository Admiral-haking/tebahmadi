import { env } from "@/lib/runtime";
import { getAdminIdentity, hasAdminRole, sameOrigin } from "../auth";
import { buildOrderFilters, canTransitionOrder, summarizeOrders } from "../../../../lib/order-operations";
import { canTransitionShipping } from "../../../../lib/shipping-state-machine";

const viewRoles = ["owner", "admin", "manager", "support"];
const editRoles = ["owner", "admin", "manager"];

export async function GET(request: Request) {
  if (!await hasAdminRole(request, viewRoles)) return Response.json({ error: "دسترسی مجاز نیست" }, { status: 401 });
  const url = new URL(request.url), id = url.searchParams.get("id");
  try {
    if (id) {
      const order = await env.DB.prepare("SELECT o.*, s.provider AS shipment_provider,s.provider_order_id,s.status AS shipment_status,s.tracking_code AS shipment_tracking_code,s.quote_toman,s.payload_json AS shipment_payload,s.last_error AS shipment_last_error, r.status AS refund_operation_status,r.provider_reference AS refund_provider_reference,r.last_error AS refund_last_error FROM orders o LEFT JOIN shipments s ON s.order_id=o.id LEFT JOIN refund_operations r ON r.order_id=o.id WHERE o.id=?").bind(id.slice(0, 80)).first<any>();
      if (!order) return Response.json({ error: "سفارش پیدا نشد" }, { status: 404 });
      const events = await env.DB.prepare("SELECT id,status,note,created_at FROM order_events WHERE order_id=? ORDER BY created_at DESC LIMIT 100").bind(id).all();
      let items: unknown[] = [];
      try { const parsed = JSON.parse(order.items_json || "[]"); if (Array.isArray(parsed)) items = parsed; } catch { /* preserve an actionable admin response for legacy corrupt rows */ }
      return Response.json({ order: { ...order, items }, events: events.results }, { headers: { "Cache-Control": "no-store" } });
    }
    const filters = buildOrderFilters({ status: url.searchParams.get("status") || undefined, shippingStatus: url.searchParams.get("shippingStatus") || undefined, q: url.searchParams.get("q") || undefined, from: url.searchParams.get("from") || undefined, to: url.searchParams.get("to") || undefined });
    const page = Math.max(1, Number(url.searchParams.get("page") || 1) || 1), limit = Math.min(100, Math.max(10, Number(url.searchParams.get("limit") || 25) || 25)), offset = (page - 1) * limit;
    const qualify = (clause: string) => clause.replace(/\bid\b/g, "o.id").replace(/\bcustomer_name\b/g, "o.customer_name").replace(/\bphone\b/g, "o.phone").replace(/\bstatus\b/g, "o.status").replace(/\bshipping_status\b/g, "o.shipping_status").replace(/\bcreated_at\b/g, "o.created_at");
    const clauses = filters.clauses.map(qualify), values = [...filters.values];
    if (url.searchParams.get("q")?.trim()) { const needle = `%${url.searchParams.get("q")!.trim().slice(0, 80)}%`; clauses.push("(o.tracking_code LIKE ? OR s.tracking_code LIKE ?)"); values.push(needle, needle); }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const rows = await env.DB.prepare(`SELECT o.*,s.provider AS shipment_provider,s.status AS shipment_status,s.tracking_code AS shipment_tracking_code FROM orders o LEFT JOIN shipments s ON s.order_id=o.id ${where} ORDER BY CASE WHEN s.status='failed' THEN 0 WHEN o.payment_status='paid' AND o.status IN ('paid','processing') AND COALESCE(s.status,'') NOT IN ('registered','in_transit','delivered') THEN 1 ELSE 2 END,o.created_at DESC LIMIT ? OFFSET ?`).bind(...values, limit, offset).all();
    const all = await env.DB.prepare(`SELECT o.status,o.payment_status,o.shipping_status,o.subtotal_toman FROM orders o LEFT JOIN shipments s ON s.order_id=o.id ${where}`).bind(...values).all();
    const total = all.results.length;
    return Response.json({ orders: rows.results, page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)), summary: summarizeOrders(all.results as any[]) }, { headers: { "Cache-Control": "no-store" } });
  } catch { return Response.json({ error: "خطا در خواندن سفارش‌ها" }, { status: 500, headers: { "Cache-Control": "no-store" } }); }
}

export async function PATCH(request: Request) {
  if (!await hasAdminRole(request, editRoles)) return Response.json({ error: "دسترسی مجاز نیست" }, { status: 401 });
  if (!sameOrigin(request)) return Response.json({ error: "مبدأ درخواست معتبر نیست" }, { status: 403 });
  let body: any; try { body = await request.json(); } catch { return Response.json({ error: "ورودی نامعتبر است" }, { status: 400 }); }
  const id = String(body.id || "").slice(0, 80); if (!id) return Response.json({ error: "شناسه سفارش لازم است" }, { status: 400 });
  const current = await env.DB.prepare("SELECT * FROM orders WHERE id=?").bind(id).first<any>(); if (!current) return Response.json({ error: "سفارش پیدا نشد" }, { status: 404 });
  const fields: string[] = [], values: any[] = [], currentShippingStatus = String(current.shipping_status || "unquoted");
  for (const [key, column, max] of [["name", "customer_name", 120], ["phone", "phone", 20], ["address", "address", 500], ["postalCode", "postal_code", 10]] as const) if (body[key] !== undefined) { const value = String(body[key]).trim(); if (!value || value.length > max) return Response.json({ error: "اطلاعات گیرنده معتبر نیست" }, { status: 400 }); fields.push(`${column}=?`); values.push(value); }
  if (body.status && body.status !== current.status) {
    if (String(body.status) === "refunded") return Response.json({ error: "عودت وجه فقط از مسیر عملیات refund انجام می‌شود تا provider، سند مالی و audit هم‌زمان ثبت شوند" }, { status: 409 });
    if (String(body.status) === "paid") return Response.json({ error: "تأیید پرداخت فقط از callback یا مسیر مالی تأییدشده انجام می‌شود" }, { status: 409 });
    if (!canTransitionOrder(current.status, String(body.status))) return Response.json({ error: "تغییر وضعیت سفارش مجاز نیست" }, { status: 409 });
    fields.push("status=?"); values.push(String(body.status));
  }
  let requestedShippingStatus = body.shippingStatus !== undefined ? String(body.shippingStatus) : "";
  if (body.trackingCode !== undefined && String(body.trackingCode).trim() && !requestedShippingStatus && ["unquoted", "quoted", "failed"].includes(currentShippingStatus)) requestedShippingStatus = "registered";
  const changedShippingStatus = requestedShippingStatus && requestedShippingStatus !== currentShippingStatus ? requestedShippingStatus : "";
  if (requestedShippingStatus) {
    const shippingStatus = requestedShippingStatus;
    if (!["unquoted", "quoted", "registered", "in_transit", "delivered", "failed", "cancelled"].includes(shippingStatus)) return Response.json({ error: "وضعیت ارسال معتبر نیست" }, { status: 400 });
    if (!canTransitionShipping(String(current.shipping_status || "unquoted"), shippingStatus)) return Response.json({ error: "تغییر وضعیت ارسال مجاز نیست" }, { status: 409 });
    fields.push("shipping_status=?"); values.push(shippingStatus);
  }
  if (body.trackingCode !== undefined) {
    const trackingCode = String(body.trackingCode).trim().slice(0, 120);
    if (trackingCode && !/^[\p{L}\p{N}_./-]+$/u.test(trackingCode)) return Response.json({ error: "کد رهگیری معتبر نیست" }, { status: 400 });
    fields.push("tracking_code=?"); values.push(trackingCode || null);
  }
  if (!fields.length && !body.note) return Response.json({ ok: true, unchanged: true });
  if (fields.length) { values.push(id); await env.DB.prepare(`UPDATE orders SET ${fields.join(",")} WHERE id=?`).bind(...values).run(); }
  if (body.trackingCode !== undefined && String(body.trackingCode).trim()) {
    const trackingCode = String(body.trackingCode).trim().slice(0, 120);
    await env.DB.prepare("INSERT INTO shipments(id,order_id,provider,status,tracking_code,payload_json,updated_at) VALUES(?,?,?,'registered',?,? ,CURRENT_TIMESTAMP) ON CONFLICT(order_id) DO UPDATE SET provider='tapin',status='registered',tracking_code=excluded.tracking_code,payload_json=excluded.payload_json,updated_at=CURRENT_TIMESTAMP").bind(crypto.randomUUID(), id, "tapin", trackingCode, JSON.stringify({ source: "manual_admin", trackingCode })).run();
    if (!changedShippingStatus && currentShippingStatus !== "registered") {
      await env.DB.prepare("UPDATE orders SET shipping_status='registered' WHERE id=?").bind(id).run();
    }
  }
  const actor = await getAdminIdentity(request);
  const note = String(body.note || `ویرایش اطلاعات سفارش توسط ${actor?.name || "ادمین"}`).slice(0, 500);
  const eventStatus = changedShippingStatus ? `shipping_${changedShippingStatus}` : body.status || current.status;
  await env.DB.prepare("INSERT INTO order_events(id,order_id,status,note) VALUES(?,?,?,?)").bind(crypto.randomUUID(), id, eventStatus, note).run();
  await env.DB.prepare("INSERT INTO audit_logs(id,actor,action,entity_type,entity_id,details) VALUES(?,?,?,?,?,?)").bind(crypto.randomUUID(), actor?.email || actor?.name || "admin", "order.update", "order", id, JSON.stringify({ fields: fields.map((field) => field.split("=")[0]), note })).run();
  return Response.json({ ok: true });
}
