import test from "node:test";
import assert from "node:assert/strict";
import { normalizeShippingMethod } from "../lib/shipping-methods";

test("normalizes a valid Post Pishtaz method", () => {
  const method = normalizeShippingMethod({ code: "POST_PISHTAZ", title: "پست پیشتاز", priceToman: 65000, freeOverToman: "", etaDays: 3 });
  assert.equal(method?.code, "post_pishtaz");
  assert.equal(method?.freeOverToman, null);
});

test("rejects invalid shipping method values", () => {
  assert.equal(normalizeShippingMethod({ code: "bad code", title: "x", priceToman: -1, etaDays: 0 }), null);
  assert.equal(normalizeShippingMethod({ code: "post", title: "پست", priceToman: 1, etaDays: 3, pricingJson: "{}" }), null);
  assert.equal(normalizeShippingMethod({ code: "post", title: "پست", priceToman: 1, etaDays: 3, settingsJson: "null" }), null);
});
