import { env } from "@/lib/runtime";

const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };

export async function GET() {
  try {
    await env.DB.prepare("SELECT 1 AS ready").first();
    const production = String(env.APP_ENV || "").toLowerCase() === "production";
    const paymentProvider = env.PAYMENT_PROVIDER || "unconfigured";
    const shippingProvider = env.SHIPPING_PROVIDER || "unconfigured";
    const smsProvider = env.SMS_PROVIDER || "unconfigured";
    const paymentConfigured = paymentProvider === "mock" ? !production : paymentProvider === "http" ? !!(env.PAYMENT_API_URL && env.PAYMENT_API_TOKEN) : paymentProvider === "zarinpal" ? !!env.ZARINPAL_MERCHANT_ID : false;
    const refundConfigured = paymentProvider === "mock" ? !production : paymentProvider === "http" ? !!(env.PAYMENT_API_URL && env.PAYMENT_API_TOKEN) : false;
    const shippingConfigured = shippingProvider === "mock" ? !production : shippingProvider === "http" ? !!(env.SHIPPING_API_URL && env.SHIPPING_API_TOKEN) : shippingProvider === "tapin" ? !!(env.TAPIN_TOKEN && env.TAPIN_SHOP_ID) : false;
    const smsConfigured = smsProvider === "mock" ? !production : smsProvider === "sms_ir" ? !!(env.SMS_IR_API_KEY && env.SMS_IR_TEMPLATE_ID) : false;
    const providers = { payment: { provider: paymentProvider, configured: paymentConfigured, refundConfigured }, shipping: { provider: shippingProvider, configured: shippingConfigured }, sms: { provider: smsProvider, configured: smsConfigured } };
    if (!paymentConfigured || !shippingConfigured || !smsConfigured) return Response.json({ status: "not_ready", database: "ok", providers }, { status: 503, headers });
    return Response.json({ status: "ready", database: "ok", providers }, { status: 200, headers });
  } catch {
    return Response.json({ status: "not_ready", database: "unavailable" }, { status: 503, headers });
  }
}
