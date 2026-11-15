import test from "node:test";
import assert from "node:assert/strict";
import { paymentUpdateApplied } from "../lib/payment-operations";

test("paymentUpdateApplied only accepts the single winning state transition", () => {
  assert.equal(paymentUpdateApplied(1), true);
  assert.equal(paymentUpdateApplied(0), false);
  assert.equal(paymentUpdateApplied(2), false);
});
