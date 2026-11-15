import test from "node:test";
import assert from "node:assert/strict";
import { calculateOrderTotals } from "../lib/order-pricing";

test("calculateOrderTotals applies product-scoped percentage discount and free shipping threshold", () => {
  assert.deepEqual(calculateOrderTotals({
    lines: [{ id: "a", priceToman: 1000, quantity: 2 }, { id: "b", priceToman: 500, quantity: 1 }],
    promotion: { kind: "percent", value: 10, maxDiscountToman: null, eligibleProductIds: ["a"] },
    shipping: { priceToman: 300, freeOverToman: 1800 },
  }), { subtotalToman: 2500, discountToman: 200, shippingToman: 0, totalToman: 2300 });
});

test("calculateOrderTotals caps fixed discount and never returns a negative total", () => {
  assert.deepEqual(calculateOrderTotals({
    lines: [{ id: "a", priceToman: 500, quantity: 1 }],
    promotion: { kind: "fixed", value: 1000, maxDiscountToman: null, eligibleProductIds: [] },
    shipping: { priceToman: 100, freeOverToman: null },
  }), { subtotalToman: 500, discountToman: 500, shippingToman: 100, totalToman: 100 });
});

test("calculateOrderTotals applies shipping promotions without discounting products", () => {
  assert.deepEqual(calculateOrderTotals({
    lines: [{ id: "a", priceToman: 500, quantity: 1 }],
    promotion: { kind: "shipping", value: 0, maxDiscountToman: null, eligibleProductIds: [] },
    shipping: { priceToman: 150, freeOverToman: null },
  }), { subtotalToman: 500, discountToman: 0, shippingToman: 0, totalToman: 500 });
});
