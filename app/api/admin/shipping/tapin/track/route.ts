import { env } from "@/lib/runtime";
import { getAdminIdentity, sameOrigin } from "../../../auth";
import { getShippingProvider } from "../../../../../../lib/commerce-providers";
import { normalizeShipmentStatus } from "../../../../../../lib/shipment-operations";

export async function POST(request: Request) {
  const actor = await getAdminIdentity(request);
  if (!actor || !["owner", "admin", "manager"].includes(actor.role)) return Response.json({ error: "دسترسی مجاز نیست" }, { status: 401 });
  if (!sameOrigin(request)) return Response.json({ error: "مبدأ درخواست معتبر نیست" }, { status: 403 });
  let body: any;
  try { body = await request.json(); } catch { return Response.json({ error: "درخواست نامعتبر است" }, { status: 400 }); }
  const orderId = String(body.orderId || "").slice(0, 80), trackingCode = String(body.trackingCode || "").trim().slice(0, 120);
  if (!orderId || (trackingCode && !/^[\p{L}\p{N}_./-]+$/u.test(trackingCode))) return Response.json({ error: "شناسه سفارش و کد رهگیری معتبر لازم است" }, { status: 400 });
  try {
    const order = await env.DB.prepare("SELECT orders.id,s.provider_order_id,s.tracking_code FROM orders LEFT JOIN shipments s ON s.order_id=orders.id AND s.provider='tapin' WHERE orders.id=?").bind(orderId).first<any>();
    if (!order) return Response.json({ error: "سفارش پیدا نشد" }, { status: 404 });
    const providerCode = env.SHIPPING_PROVIDER === "tapin" ? String(order.provider_order_id || trackingCode || "") : (trackingCode || order.tracking_code || "");
    if (!providerCode) return Response.json({ error: "کد رهگیری مرسوله ثبت نشده است" }, { status: 422 });
    const result = await getShippingProvider(env).track(providerCode);
    const status = normalizeShipmentStatus(result.status), shippingStatus = status === "pending" ? "registered" : status, code = result.trackingCode || trackingCode || order.tracking_code;
    if (!code) return Response.json({ error: "کد رهگیری مرسوله ثبت نشده است" }, { status: 422 });
    await env.DB.prepare("INSERT INTO shipments(id,order_id,provider,status,tracking_code,payload_json,updated_at) VALUES(?,?,?,'registered',?,?,CURRENT_TIMESTAMP) ON CONFLICT(order_id) DO UPDATE SET status=excluded.status,tracking_code=excluded.tracking_code,payload_json=excluded.payload_json,updated_at=CURRENT_TIMESTAMP").bind(crypto.randomUUID(), orderId, "tapin", status, code, JSON.stringify({ source: "tracking_update", providerCode })).run();
    await env.DB.prepare("UPDATE orders SET shipping_status=?,tracking_code=? WHERE id=?").bind(shippingStatus, code, orderId).run();
    await env.DB.prepare("INSERT INTO shipment_events(id,shipment_id,status,provider_status,tracking_code,message,raw_safe_json) SELECT ?,id,?,?,?,?,? FROM shipments WHERE order_id=? AND provider='tapin'").bind(crypto.randomUUID(), status, result.status || null, code, `وضعیت مرسوله به‌روزرسانی شد`, JSON.stringify({ provider: env.SHIPPING_PROVIDER || "mock", status: result.status || null }), orderId).run().catch(()=>{});
    await env.DB.prepare("INSERT INTO order_events(id,order_id,status,note) VALUES(?,?,?,?)").bind(crypto.randomUUID(), orderId, `shipping_${shippingStatus}`, `وضعیت مرسوله با کد ${code} به‌روزرسانی شد`).run();
    await env.DB.prepare("INSERT INTO audit_logs(id,actor,action,entity_type,entity_id,details) VALUES(?,?,?,?,?,?)").bind(crypto.randomUUID(), actor.email || actor.name || "admin", "shipment.track", "order", orderId, JSON.stringify({ provider: env.SHIPPING_PROVIDER || "mock", status: shippingStatus, trackingCode: code })).run();
    return Response.json({ ok: true, status: shippingStatus, trackingCode: code, provider: env.SHIPPING_PROVIDER || "mock" });
  } catch { return Response.json({ error: "به‌روزرسانی وضعیت مرسوله ناموفق بود" }, { status: 502 }); }
}
