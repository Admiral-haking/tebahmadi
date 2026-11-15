import assert from "node:assert/strict";
import test from "node:test";
import { validateServerConfig } from "../lib/server-config";

const secret = "a".repeat(48);

test("server config accepts server mode with real SMS.ir and mock commerce providers", () => {
  const result = validateServerConfig({
    APP_ENV: "server",
    ADMIN_SESSION_SECRET: secret,
    OTP_PEPPER: "b".repeat(48),
    PAYMENT_PROVIDER: "mock",
    SHIPPING_PROVIDER: "mock",
    SMS_PROVIDER: "sms_ir",
    SMS_IR_API_KEY: "redacted-test-key",
    SMS_IR_OTP_TEMPLATE_ID: "765432",
  });

  assert.deepEqual(result, { ok: true, errors: [] });
});

test("server config rejects missing strong secrets and incomplete SMS.ir settings", () => {
  const result = validateServerConfig({
    APP_ENV: "local",
    ADMIN_SESSION_SECRET: "local-admin-secret",
    OTP_PEPPER: "local-otp-pepper",
    SMS_PROVIDER: "sms_ir",
  });

  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes("ADMIN_SESSION_SECRET")));
  assert.ok(result.errors.some((error) => error.includes("OTP_PEPPER")));
  assert.ok(result.errors.some((error) => error.includes("SMS_IR_API_KEY")));
});

test("server config rejects a non-numeric SMS.ir OTP template id", () => {
  const result = validateServerConfig({
    APP_ENV: "server",
    ADMIN_SESSION_SECRET: secret,
    OTP_PEPPER: "b".repeat(48),
    PAYMENT_PROVIDER: "mock",
    SHIPPING_PROVIDER: "mock",
    SMS_PROVIDER: "sms_ir",
    SMS_IR_API_KEY: "redacted-test-key",
    SMS_IR_OTP_TEMPLATE_ID: "replace-with-approved-otp-template-id",
  });

  assert.equal(result.ok, false);
  assert.ok(result.errors.includes("SMS_IR_OTP_TEMPLATE_ID must be a positive integer"));
});

test("server config enforces real providers in production", () => {
  const result = validateServerConfig({
    APP_ENV: "production",
    ADMIN_SESSION_SECRET: secret,
    OTP_PEPPER: "b".repeat(48),
    PAYMENT_PROVIDER: "zarinpal",
    ZARINPAL_MERCHANT_ID: "merchant",
    SHIPPING_PROVIDER: "tapin",
    TAPIN_TOKEN: "token",
    TAPIN_SHOP_ID: "shop",
    SMS_PROVIDER: "sms_ir",
    SMS_IR_API_KEY: "redacted-test-key",
    SMS_IR_OTP_TEMPLATE_ID: "765432",
  });

  assert.deepEqual(result, { ok: true, errors: [] });
});
