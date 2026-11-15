import test from "node:test";
import assert from "node:assert/strict";
import { normalizeIdempotencyKey } from "../lib/order-idempotency";

test("normalizeIdempotencyKey accepts bounded safe keys and rejects malformed keys", () => {
  assert.equal(normalizeIdempotencyKey(" checkout-123_ABC "), "checkout-123_ABC");
  assert.equal(normalizeIdempotencyKey("x".repeat(129)), null);
  assert.equal(normalizeIdempotencyKey("نامعتبر"), null);
  assert.equal(normalizeIdempotencyKey(""), null);
});
