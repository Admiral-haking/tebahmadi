import { env } from "@/lib/runtime";
import { getZarinpalConfig, zarinpalGatewayUrl } from "../../../../../lib/zarinpal";
import { getPaymentProvider } from "../../../../../lib/commerce-providers";
import { validOrigin } from "../../../customer/session";

export async function POST(request: Request) {
  if (!validOrigin(request)) return Response.json({ error: "مبدأ درخواست معتبر نیست" }, { status: 403 });
  let body: any;
  try { body = await request.json(); } catch { return Response.json({ error: "درخواست نامعتبر است" }, { status: 400 }); }
  const orderId = String(body.orderId || "").slice(0, 80);
  const localMock = env.PAYMENT_PROVIDER === "mock";
  if (!orderId) return Response.json({ error: "شناسه سفارش لازم است" }, { status: 400 });
  const order = await env.DB.prepare("SELECT id,customer_name,phone,subtotal_toman,status,payment_status,payment_authority FROM orders WHERE id=?").bind(orderId).first<any>();
  if (!order) return Response.json({ error: "سفارش پیدا نشد" }, { status: 404 });
  if (order.payment_status === "paid") return Response.json({ error: "این سفارش قبلاً پرداخت شده است" }, { status: 409 });
  const origin = new URL(request.url).origin;
  if (order.payment_status === "pending" && order.payment_authority === "requesting") return Response.json({ error: "درخواست پرداخت دیگری برای این سفارش در حال ایجاد است" }, { status: 409 });
  if (order.payment_status !== "pending" || !order.payment_authority) {
    const claim = await env.DB.prepare("UPDATE orders SET payment_status='pending',payment_authority='requesting' WHERE id=? AND payment_status<>'paid' AND (payment_status<>'pending' OR payment_authority IS NULL)").bind(order.id).run();
    if (!(claim.meta?.changes || 0)) {
      const current = await env.DB.prepare("SELECT payment_status,payment_authority FROM orders WHERE id=?").bind(order.id).first<any>();
      if (current?.payment_status === "paid") return Response.json({ error: "این سفارش قبلاً پرداخت شده است" }, { status: 409 });
      if (current?.payment_status === "pending" && current.payment_authority && current.payment_authority !== "requesting") {
        const gatewayUrl = localMock ? `${origin}/api/payments/zarinpal/callback?orderId=${encodeURIComponent(order.id)}&authority=${encodeURIComponent(current.payment_authority)}&Status=OK` : zarinpalGatewayUrl(getZarinpalConfig(env), String(current.payment_authority));
        return Response.json({ authority: current.payment_authority, gatewayUrl, orderId: order.id, reused: true }, { headers: { "Cache-Control": "no-store" } });
      }
      return Response.json({ error: "درخواست پرداخت دیگری برای این سفارش در حال ایجاد است" }, { status: 409 });
    }
  }
  try {
    const result = await getPaymentProvider(env).createPayment({ orderId: order.id, amountToman: Number(order.subtotal_toman), callbackUrl: `${origin}/api/payments/zarinpal/callback?orderId=${encodeURIComponent(order.id)}` });
    await env.DB.prepare("UPDATE orders SET payment_status='pending',payment_authority=? WHERE id=? AND payment_status='pending' AND payment_authority='requesting'").bind(result.authority, order.id).run();
    return Response.json({ authority: result.authority, gatewayUrl: result.redirectUrl, orderId: order.id }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { await env.DB.prepare("UPDATE orders SET payment_status='unpaid',payment_authority=NULL WHERE id=? AND payment_status='pending' AND payment_authority='requesting'").bind(order.id).run(); return Response.json({ error: error instanceof Error ? error.message : "ساخت درگاه ناموفق بود" }, { status: 502 }); }
}
