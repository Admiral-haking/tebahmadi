import assert from "node:assert/strict";
import test from "node:test";
import { HttpPaymentProvider, MockPaymentProvider, MockShippingProvider, TapinShippingProvider, ZarinPalPaymentProvider, getPaymentProvider, getShippingProvider } from "../lib/commerce-providers";
import { getTapinConfig, trackTapinShipment } from "../lib/tapin";
import { normalizeShipmentStatus } from "../lib/shipment-operations";
import { sendOtpSms } from "../lib/sms-provider";

test("mock payment creates and verifies an order payment", async () => {
  const provider = new MockPaymentProvider();
  const created = await provider.createPayment({ orderId: "order-1", amountToman: 1000, callbackUrl: "/payment/callback" });
  assert.equal(created.status, "pending");
  assert.match(created.redirectUrl!, /authority=mock_order-1/);
  assert.match(created.redirectUrl!, /Status=OK/);
  assert.equal((await provider.verifyPayment({ orderId: "order-1", authority: created.authority!, amountToman: 1000 })).status, "paid");
  assert.equal((await provider.verifyPayment({ orderId: "order-1", authority: "wrong", amountToman: 1000 })).status, "failed");
  assert.equal((await provider.verifyPayment({ orderId: "order-1", authority: created.authority!, amountToman: 0 })).status, "failed");
});

test("mock shipping returns a quote and deterministic tracking code", async () => {
  const provider = new MockShippingProvider();
  assert.deepEqual(await provider.quote({ postalCode: "1234567890" }), [{ service: "ارسال عادی", amountToman: 85000, etaDays: 3 }]);
  const shipment = await provider.createShipment("order-123456789", { postalCode: "1234567890" });
  assert.equal(shipment.trackingCode, "MOCK-ORDER-12");
  assert.equal((await provider.track(shipment.trackingCode!)).status, "created");
});

test("provider factories keep local mode deterministic and require HTTP credentials", () => {
  assert.ok(getPaymentProvider({ PAYMENT_PROVIDER: "mock" }) instanceof MockPaymentProvider);
  assert.ok(getShippingProvider({ SHIPPING_PROVIDER: "mock" }) instanceof MockShippingProvider);
  assert.throws(() => getPaymentProvider({}), /payment_provider_not_configured/);
  assert.throws(() => getShippingProvider({}), /shipping_provider_not_configured/);
  assert.throws(() => getPaymentProvider({ PAYMENT_PROVIDER: "http" }), /payment_provider_not_configured/);
  assert.ok(getPaymentProvider({ PAYMENT_PROVIDER: "http", PAYMENT_API_URL: "https://payments.test", PAYMENT_API_TOKEN: "token" }) instanceof HttpPaymentProvider);
  assert.throws(() => getPaymentProvider({ PAYMENT_PROVIDER: "zarinpal" }), /zarinpal_not_configured/);
  assert.ok(getPaymentProvider({ PAYMENT_PROVIDER: "zarinpal", ZARINPAL_MERCHANT_ID: "merchant" }) instanceof ZarinPalPaymentProvider);
  assert.throws(() => getShippingProvider({ SHIPPING_PROVIDER: "tapin" }), /tapin_not_configured/);
  assert.ok(getShippingProvider({ SHIPPING_PROVIDER: "tapin", TAPIN_TOKEN: "token", TAPIN_SHOP_ID: "shop" }) instanceof TapinShippingProvider);
});

test("Tapin tracking uses the official status report contract without leaking credentials", async () => {
  const originalFetch = globalThis.fetch;
  let seenUrl = "", seenBody: unknown, seenAuth = "";
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    seenUrl = String(input); seenBody = JSON.parse(String(init?.body)); seenAuth = String(new Headers(init?.headers).get("Authorization"));
    return new Response(JSON.stringify({ list: [{ order_id: 77, barcode: "IR-77", status: 7 }] }), { status: 200, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;
  try {
    const result = await trackTapinShipment(getTapinConfig({ TAPIN_TOKEN: "secret-token", TAPIN_SHOP_ID: "shop-1", TAPIN_BASE_URL: "https://tapin.test/api/v2/public" }), 77);
    assert.equal(seenUrl, "https://tapin.test/api/v2/public/order/post/get-status/report/");
    assert.deepEqual(seenBody, { orders_id: [77] });
    assert.equal(seenAuth, "secret-token");
    assert.equal(result.list?.[0].barcode, "IR-77");
    assert.equal(normalizeShipmentStatus(result.list?.[0].status), "delivered");
  } finally { globalThis.fetch = originalFetch; }
});

test("Tapin provider adapter maps quote, registration, and tracking contracts", async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
  let responseIndex = 0;
  const responses = [
    { data: { send_price: 92000 } },
    { data: { id: "shipment-1", order_id: "77", barcode: "IR-77", status: 2, send_price: 92000 } },
    { list: [{ order_id: 77, barcode: "IR-77", status: 7 }] },
  ];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), body: JSON.parse(String(init?.body)) });
    return new Response(JSON.stringify(responses[responseIndex++]), { status: 200, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;
  try {
    const provider = getShippingProvider({ SHIPPING_PROVIDER: "tapin", TAPIN_TOKEN: "secret", TAPIN_SHOP_ID: "shop", TAPIN_BASE_URL: "https://tapin.test/api/v2/public" });
    const quote = await provider.quote({ postalCode: "1234567890", provinceCode: 1, cityCode: 2, weightGrams: 500 });
    assert.equal(quote[0].amountToman, 92000);
    const shipment = await provider.createShipment("77", { postalCode: "1234567890", provinceCode: 1, cityCode: 2, weightGrams: 500, recipient: { name: "مشتری تست", mobile: "09120000000", address: "تهران", postalCode: "1234567890" }, items: [{ name: "محصول", quantity: 1, priceToman: 100000, weightGrams: 500 }] });
    assert.equal(shipment.trackingCode, "IR-77");
    const tracked = await provider.track("77");
    assert.equal(tracked.status, "delivered");
    assert.equal(calls[0].body.shop_id, "shop");
    assert.equal(calls[1].body.recipient_mobile, "09120000000");
    assert.deepEqual(calls[2].body, { orders_id: [77] });
    assert.equal(calls.every((call) => !JSON.stringify(call.body).includes("secret")), true);
  } finally { globalThis.fetch = originalFetch; }
});

test("SMS.ir OTP adapter uses the API key header and verify template", async () => {
  const originalFetch = globalThis.fetch;
  let seenUrl = "";
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    seenUrl = String(input);
    return new Response(JSON.stringify({ status: 1, message: "موفق", data: { messageId: 1 } }), { status: 200, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;
  try {
    await sendOtpSms({ SMS_IR_API_KEY: "secret-key", SMS_IR_TEMPLATE_ID: "123456" }, "09120000000", "1234");
    assert.equal(seenUrl, "https://api.sms.ir/v1/send/verify");
    await assert.rejects(() => sendOtpSms({}, "09120000000", "1234"), /sms_not_configured/);
  } finally { globalThis.fetch = originalFetch; }
});
