import assert from "node:assert/strict";
import test from "node:test";
import { getZarinpalConfig, zarinpalGatewayUrl } from "../lib/zarinpal";
import { getTapinConfig, TapinError } from "../lib/tapin";

test("ZarinPal configuration is explicit and defaults to toman input", () => {
  assert.deepEqual(getZarinpalConfig({ ZARINPAL_MERCHANT_ID: "merchant", ZARINPAL_SANDBOX: "true" }), { merchantId: "merchant", sandbox: true, amountUnit: "toman" });
  assert.throws(() => getZarinpalConfig({}), /zarinpal_not_configured/);
});

test("ZarinPal gateway URL is selected by environment and safely encodes authority", () => {
  assert.equal(zarinpalGatewayUrl({ merchantId: "m", sandbox: true, amountUnit: "toman" }, "A/B"), "https://sandbox.zarinpal.com/pg/StartPay/A%2FB");
});

test("Tapin configuration never silently accepts a missing token or shop", () => {
  assert.throws(() => getTapinConfig({ TAPIN_TOKEN: "token" }), (error: unknown) => error instanceof TapinError && error.message === "tapin_not_configured");
  assert.deepEqual(getTapinConfig({ TAPIN_TOKEN: "token", TAPIN_SHOP_ID: "shop" }).baseUrl, "https://api.tapin.ir/api/v2/public");
});
