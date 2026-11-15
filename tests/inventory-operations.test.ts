import test from "node:test";
import assert from "node:assert/strict";
import { applyInventoryDelta } from "../lib/inventory-operations";

test("applyInventoryDelta rejects negative or overflowing stock", () => {
  assert.equal(applyInventoryDelta(10, -10), 0);
  assert.equal(applyInventoryDelta(10, -11), null);
  assert.equal(applyInventoryDelta(99999, 1), 100000);
  assert.equal(applyInventoryDelta(100000, 1), null);
});
