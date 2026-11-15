import test from "node:test";
import assert from "node:assert/strict";
import { addCartQuantity, normalizeCart, setCartQuantity } from "../lib/cart-quantities";

test("cart quantities are integer, positive, and capped by stock", () => {
  assert.deepEqual(normalizeCart({ a: 2.8, b: 0, c: -1, d: "3" }), { a: 2, d: 3 });
  assert.equal(addCartQuantity(2, 4, 5), 5);
  assert.equal(addCartQuantity(5, 1, 5), 5);
  assert.equal(setCartQuantity(5, 0), 0);
  assert.equal(setCartQuantity(5, 8, 6), 6);
});
