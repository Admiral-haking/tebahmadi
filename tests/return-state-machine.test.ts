import test from "node:test";
import assert from "node:assert/strict";
import { canTransitionReturn, isReturnStatus, returnRequiresRefundRole } from "../lib/return-state-machine";

test("return state machine permits only operational transitions", () => {
  assert.equal(canTransitionReturn("requested", "approved"), true);
  assert.equal(canTransitionReturn("approved", "received"), true);
  assert.equal(canTransitionReturn("received", "refunded"), true);
  assert.equal(canTransitionReturn("requested", "refunded"), false);
  assert.equal(canTransitionReturn("closed", "approved"), false);
});

test("return state machine rejects unknown states and protects refunds", () => {
  assert.equal(isReturnStatus("received"), true);
  assert.equal(isReturnStatus("unknown"), false);
  assert.equal(returnRequiresRefundRole("refunded", "manager"), true);
  assert.equal(returnRequiresRefundRole("refunded", "admin"), false);
  assert.equal(returnRequiresRefundRole("closed", "manager"), false);
});
