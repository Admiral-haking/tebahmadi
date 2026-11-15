import test from "node:test";
import assert from "node:assert/strict";
import { canTransitionShipping } from "../lib/shipping-state-machine";

test("shipping transitions follow the operational lifecycle", () => {
  assert.equal(canTransitionShipping("unquoted", "quoted"), true);
  assert.equal(canTransitionShipping("quoted", "registered"), true);
  assert.equal(canTransitionShipping("registered", "in_transit"), true);
  assert.equal(canTransitionShipping("in_transit", "delivered"), true);
  assert.equal(canTransitionShipping("registered", "delivered"), true);
  assert.equal(canTransitionShipping("unquoted", "delivered"), false);
  assert.equal(canTransitionShipping("unquoted", "registered"), true);
  assert.equal(canTransitionShipping("delivered", "failed"), false);
  assert.equal(canTransitionShipping("failed", "registered"), true);
});
