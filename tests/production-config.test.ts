import assert from "node:assert/strict";
import test from "node:test";
import { validateProductionConfig } from "../lib/production-config";

test("production config rejects implicit mock and missing secrets", () => {
  const errors = validateProductionConfig({ PAYMENT_PROVIDER: "mock", SHIPPING_PROVIDER: "mock" });
  assert.ok(errors.some((error) => error.includes("PAYMENT_PROVIDER")));
  assert.ok(errors.some((error) => error.includes("ADMIN_SESSION_SECRET")));
});

test("production config accepts configured ZarinPal, Tapin, and SMS.ir", () => {
  assert.deepEqual(validateProductionConfig({ APP_ENV: "production", PAYMENT_PROVIDER: "zarinpal", ZARINPAL_MERCHANT_ID: "merchant", SHIPPING_PROVIDER: "tapin", TAPIN_TOKEN: "token", TAPIN_SHOP_ID: "shop", SMS_PROVIDER: "sms_ir", ADMIN_SESSION_SECRET: "admin", OTP_PEPPER: "otp", SMS_IR_API_KEY: "sms", SMS_IR_TEMPLATE_ID: "123" }), []);
});
