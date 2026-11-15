import test from "node:test";
import assert from "node:assert/strict";
import { orderResponseTotals } from "../lib/order-response";

test("order retry response separates discounted subtotal, shipping, and total", () => {
  assert.deepEqual(orderResponseTotals({ subtotal_toman: 115000, discount_toman: 10000, shipping_toman: 25000 }), {
    subtotalToman: 90000,
    shippingToman: 25000,
    totalToman: 115000,
    discountToman: 10000,
  });
});
