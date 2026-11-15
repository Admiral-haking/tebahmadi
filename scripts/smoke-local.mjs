const baseUrl = (process.env.TAB_AHMADI_BASE_URL || "http://127.0.0.1:5173").replace(/\/$/, "");
const checks = [
  ["home page", "/", 200],
  ["products page", "/products", 200],
  ["tracking page", "/track", 200],
  ["health", "/api/health", 200],
  ["readiness", "/api/readiness", 200],
  ["products API", "/api/products", 200],
  ["shipping methods API", "/api/shipping/methods", 200],
];

for (const [name, path, expected] of checks) {
  const response = await fetch(`${baseUrl}${path}`, { redirect: "manual" });
  if (response.status !== expected) throw new Error(`${name}: expected ${expected}, got ${response.status}`);
  if (path.startsWith("/api/")) {
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) throw new Error(`${name}: expected JSON response`);
  }
  console.log(`ok - ${name} (${response.status})`);
}

const health = await (await fetch(`${baseUrl}/api/health`)).json();
if (health.status !== "ok") throw new Error("health payload is not ready");
const readiness = await (await fetch(`${baseUrl}/api/readiness`)).json();
if (readiness.status !== "ready" || readiness.database !== "ok" || readiness.providers?.payment?.refundConfigured !== true) throw new Error("readiness payload is not ready for local refunds");

const products = await (await fetch(`${baseUrl}/api/products`)).json();
const product = (products.products || products.items || [])[0];
if (!product?.id) throw new Error("no active product available for checkout smoke");
const promotionResponse = await fetch(`${baseUrl}/api/promotions/validate`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Origin: baseUrl },
  body: JSON.stringify({ code: "LOCAL10", items: [{ id: product.id, quantity: 1 }] }),
});
if (promotionResponse.status !== 200) throw new Error(`promotion smoke: expected 200, got ${promotionResponse.status}`);
const promotion = await promotionResponse.json();
if (promotion.discountToman !== 10000) throw new Error(`promotion smoke returned ${promotion.discountToman} instead of 10000`);
console.log("ok - server promotion validation");
const idempotencyKey = `smoke-${Date.now()}`;
const orderResponse = await fetch(`${baseUrl}/api/orders`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Origin: baseUrl, "Idempotency-Key": idempotencyKey },
  body: JSON.stringify({
    name: "تست smoke",
    phone: "09121234567",
    address: "تهران، خیابان تست، پلاک ۱",
    postalCode: "1234567890",
    shippingMethod: "post_pishtaz",
    items: [{ id: product.id, quantity: 1 }],
    coupon: "LOCAL10",
  }),
});
if (orderResponse.status !== 201) throw new Error(`checkout smoke: expected 201, got ${orderResponse.status}`);
const order = await orderResponse.json();
if (!order.orderId || order.discountToman !== 10000 || order.totalToman !== 90000) throw new Error("checkout smoke returned invalid discounted totals");
console.log(`ok - checkout and server pricing (${order.orderId})`);

const retry = await fetch(`${baseUrl}/api/orders`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Origin: baseUrl, "Idempotency-Key": idempotencyKey },
  body: JSON.stringify({
    name: "تست smoke",
    phone: "09121234567",
    address: "تهران، خیابان تست، پلاک ۱",
    postalCode: "1234567890",
    shippingMethod: "post_pishtaz",
    items: [{ id: product.id, quantity: 1 }],
    coupon: "LOCAL10",
  }),
});
const retryPayload = await retry.json();
if (retry.status !== 200 || retryPayload.orderId !== order.orderId || retryPayload.idempotent !== true) throw new Error("idempotency smoke did not reuse the original order");
console.log("ok - order idempotency");
console.log(`Smoke checks passed for ${baseUrl}`);
