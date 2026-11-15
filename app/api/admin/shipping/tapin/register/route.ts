import { env } from "@/lib/runtime";
import { hasAdminRole, sameOrigin } from "../../../auth";
import { normalizeShipmentStatus, shipmentClaimDecision } from "../../../../../../lib/shipment-operations";
import { safeJsonObjectString } from "../../../../../../lib/safe-json";
import { getShippingProvider } from "../../../../../../lib/commerce-providers";

const storedShipmentPayload = (value: unknown) => JSON.parse(safeJsonObjectString(value));

export async function POST(request: Request) {
  if (!await hasAdminRole(request, ["owner", "admin", "manager"])) return Response.json({ error: "دسترسی مجاز نیست" }, { status: 401 });
  if (!sameOrigin(request)) return Response.json({ error: "مبدأ درخواست معتبر نیست" }, { status: 403 });
  let body: any;
  try { body = await request.json(); } catch { return Response.json({ error: "درخواست نامعتبر است" }, { status: 400 }); }
  const orderId = String(body.orderId || "").slice(0, 80);
  if (!orderId) return Response.json({ error: "شناسه سفارش الزامی است" }, { status: 400 });
  const provinceCode = Number(body.provinceCode), cityCode = Number(body.cityCode), weightGrams = Number(body.weightGrams);
  if (!Number.isSafeInteger(provinceCode) || provinceCode < 1 || !Number.isSafeInteger(cityCode) || cityCode < 1 || !Number.isSafeInteger(weightGrams) || weightGrams < 1 || weightGrams > 100000) return Response.json({ error: "اطلاعات استان، شهر یا وزن مرسوله نامعتبر است" }, { status: 400 });
  try {
    const order = await env.DB.prepare("SELECT id,customer_name,phone,address,postal_code,items_json,status,payment_status FROM orders WHERE id=?").bind(orderId).first<any>();
    if (!order) return Response.json({ error: "سفارش پیدا نشد" }, { status: 404 });
    if (order.payment_status !== "paid" && order.status !== "paid" && order.status !== "processing") return Response.json({ error: "فقط سفارش پرداخت‌شده آماده ثبت ارسال است" }, { status: 409 });
    let canonicalItems: any[] = [];
    try { canonicalItems = JSON.parse(order.items_json || "[]"); } catch { return Response.json({ error: "اقلام سفارش نامعتبر است" }, { status: 422 }); }
    if (!Array.isArray(canonicalItems) || !canonicalItems.length || canonicalItems.length > 50 || canonicalItems.some((item: any) => !String(item?.id || "") || !String(item?.name || "") || !Number.isSafeInteger(Math.floor(Number(item?.quantity))) || Math.floor(Number(item.quantity)) < 1)) return Response.json({ error: "سفارش فاقد اقلام معتبر است" }, { status: 422 });
    let existing = await env.DB.prepare("SELECT provider_order_id,status,tracking_code,payload_json FROM shipments WHERE order_id=? AND provider='tapin'").bind(orderId).first<any>();
    const decision = shipmentClaimDecision(existing ? { status: existing.status, trackingCode: existing.tracking_code } : null);
    if (decision === "idempotent") return Response.json({ provider: "tapin", shipment: storedShipmentPayload(existing.payload_json), idempotent: true });
    if (decision === "busy") return Response.json({ error: "ثبت مرسوله دیگری برای این سفارش در حال انجام است" }, { status: 409 });
    if (decision === "retry") {
      const claimed = await env.DB.prepare("UPDATE shipments SET status='pending',last_error=NULL,payload_json='{}',updated_at=CURRENT_TIMESTAMP WHERE order_id=? AND provider='tapin' AND status='failed'").bind(orderId).run();
      if (!claimed.meta?.changes) {
        existing = await env.DB.prepare("SELECT provider_order_id,status,tracking_code,payload_json FROM shipments WHERE order_id=? AND provider='tapin'").bind(orderId).first<any>();
        const retryDecision = shipmentClaimDecision(existing ? { status: existing.status, trackingCode: existing.tracking_code } : null);
        if (retryDecision === "idempotent") return Response.json({ provider: "tapin", shipment: storedShipmentPayload(existing.payload_json), idempotent: true });
        return Response.json({ error: "ثبت مرسوله دیگری برای این سفارش در حال انجام است" }, { status: 409 });
      }
    } else if (decision === "claim") {
      const claimed = await env.DB.prepare("INSERT INTO shipments(id,order_id,provider,status,payload_json,updated_at) VALUES(?,?,?,'pending','{}',CURRENT_TIMESTAMP) ON CONFLICT(order_id) DO NOTHING").bind(crypto.randomUUID(), orderId, "tapin").run();
      if (!claimed.meta?.changes) return Response.json({ error: "ثبت مرسوله دیگری برای این سفارش در حال انجام است" }, { status: 409 });
    }
    const shipment = await getShippingProvider(env).createShipment(orderId, {
      postalCode: String(order.postal_code || "").slice(0, 10), province: String(provinceCode), city: String(cityCode), provinceCode, cityCode, weightGrams,
      recipient: { name: String(order.customer_name).slice(0, 120), mobile: String(order.phone).slice(0, 20), address: String(order.address).slice(0, 500), postalCode: String(order.postal_code || "").slice(0, 10) },
      items: canonicalItems.slice(0, 50).map((item: any) => ({ name: String(item.name).slice(0, 160), quantity: Math.max(1, Math.floor(Number(item.quantity))), priceToman: Math.max(0, Math.floor(Number(item.priceToman || item.price || 0))), weightGrams: Math.max(1, Math.floor(Number(item.weightGrams || 100))) })),
    });
    const data = { id: shipment.trackingCode, order_id: orderId, barcode: shipment.trackingCode, status: shipment.status === "created" ? "registered" : shipment.status, send_price: 0 };
    const shipmentStatus = normalizeShipmentStatus(data.status);
    await env.DB.prepare("UPDATE shipments SET provider_order_id=?,status=?,tracking_code=?,quote_toman=?,payload_json=?,last_error=NULL,updated_at=CURRENT_TIMESTAMP WHERE order_id=? AND provider='tapin'").bind(data.order_id || data.id || null, shipmentStatus, data.barcode || null, Number(data.send_price || 0), JSON.stringify(data), orderId).run();
    // The customer-facing method is Post Express; Tapin is only the backend
    // connector used to register the parcel and obtain its tracking code.
    await env.DB.prepare("UPDATE orders SET shipping_method='post_pishtaz',shipping_status='registered',tracking_code=? WHERE id=?").bind(data.barcode || null, orderId).run();
    await env.DB.prepare("INSERT INTO shipment_events(id,shipment_id,status,provider_status,tracking_code,message,raw_safe_json) SELECT ?,id,?,?,?,?,? FROM shipments WHERE order_id=? AND provider='tapin'").bind(crypto.randomUUID(), shipmentStatus, data.status || null, data.barcode || null, "مرسوله ثبت شد", JSON.stringify({ provider: "tapin", status: data.status || null }), orderId).run().catch(()=>{});
    await env.DB.prepare("INSERT INTO order_events(id,order_id,status,note) VALUES(?,?,'shipping_registered',?)").bind(crypto.randomUUID(), orderId, `مرسوله با اتصال تاپین ثبت شد${data.barcode ? `؛ کد رهگیری ${String(data.barcode).slice(0, 120)}` : ""}`).run();
    await env.DB.prepare("INSERT INTO audit_logs(id,actor,action,entity_type,entity_id,details) VALUES(?,?,?,?,?,?)").bind(crypto.randomUUID(), "admin", "shipment.register", "order", orderId, JSON.stringify({ provider: "tapin", trackingCode: data.barcode || null })).run();
    return Response.json({ provider: "tapin", shipment: data }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error && error.name === "TapinError" ? "tapin_provider_error" : "tapin_request_failed";
    const failed = await env.DB.prepare("UPDATE shipments SET status='failed',last_error=?,payload_json=?,updated_at=CURRENT_TIMESTAMP WHERE order_id=? AND provider='tapin' AND status='pending'").bind(message, JSON.stringify({}), orderId).run();
    if (failed.meta?.changes) {
      await env.DB.prepare("INSERT INTO order_events(id,order_id,status,note) VALUES(?,?,'shipping_failed',?)").bind(crypto.randomUUID(), orderId, `ثبت مرسوله ناموفق بود: ${message}`).run();
      await env.DB.prepare("INSERT INTO shipment_events(id,shipment_id,status,message,raw_safe_json) SELECT ?,id,'failed',?,? FROM shipments WHERE order_id=? AND provider='tapin'").bind(crypto.randomUUID(), message, JSON.stringify({ provider: "tapin", error: message }), orderId).run().catch(()=>{});
      await env.DB.prepare("INSERT INTO audit_logs(id,actor,action,entity_type,entity_id,details) VALUES(?,?,?,?,?,?)").bind(crypto.randomUUID(), "admin", "shipment.register_failed", "order", orderId, JSON.stringify({ provider: "tapin", error: message })).run();
    }
    return Response.json({ error: "ثبت مرسوله ناموفق بود؛ وضعیت اتصال سرویس را بررسی کنید" }, { status: 502 });
  }
}
