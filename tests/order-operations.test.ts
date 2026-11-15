import test from "node:test";
import assert from "node:assert/strict";
import { csvEscape, buildOrderFilters, summarizeOrders, canTransitionOrder, ordersToCsv } from "../lib/order-operations";

test("csvEscape protects commas, quotes and spreadsheet formulas", () => {
  assert.equal(csvEscape('نام, "ویژه"'), '="نام, ""ویژه"""');
  assert.equal(csvEscape("=1+1"), "'=1+1");
});

test("ordersToCsv includes shipment provider and tracking fields", () => {
  const csv = ordersToCsv([{ id: "o-1", customer_name: "مشتری", phone: "0912", address: "تهران", status: "shipped", payment_status: "paid", shipping_status: "registered", shipment_provider: "tapin", shipment_status: "registered", shipment_tracking_code: "TRK-1", discount_toman: 0, shipping_toman: 50000, subtotal_toman: 250000, created_at: "2026-11-12" }]);
  assert.match(csv, /provider ارسال/);
  assert.match(csv, /tapin/);
  assert.match(csv, /TRK-1/);
});

test("buildOrderFilters ignores an incomplete date range", () => {
  assert.deepEqual(buildOrderFilters({ status: "paid", from: "2026-01-01" }), { clauses: ["status = ?"], values: ["paid"] });
});

test("buildOrderFilters supports validated shipping status", () => {
  assert.deepEqual(buildOrderFilters({ shippingStatus: "registered", q: "A-12" }), {
    clauses: ["shipping_status = ?", "(id LIKE ? OR customer_name LIKE ? OR phone LIKE ?)"],
    values: ["registered", "%A-12%", "%A-12%", "%A-12%"],
  });
  assert.deepEqual(buildOrderFilters({ shippingStatus: "invalid" }), { clauses: [], values: [] });
});

test("buildOrderFilters supports in-transit and cancelled shipments", () => {
  assert.deepEqual(buildOrderFilters({ shippingStatus: "in_transit" }).values, ["in_transit"]);
  assert.deepEqual(buildOrderFilters({ shippingStatus: "cancelled" }).values, ["cancelled"]);
});

test("summarizeOrders reports revenue and operational buckets", () => {
  const result = summarizeOrders([
    { status: "paid", payment_status: "paid", shipping_status: "unquoted", subtotal_toman: 1000 },
    { status: "shipped", payment_status: "paid", shipping_status: "registered", subtotal_toman: 2500 },
    { status: "cancelled", payment_status: "unpaid", shipping_status: "unquoted", subtotal_toman: 500 },
  ]);
  assert.deepEqual(result, { count: 3, revenueToman: 3500, paid: 2, readyToShip: 1, shipped: 1, cancelled: 1 });
});

test("order transitions reject impossible changes", () => {
  assert.equal(canTransitionOrder("paid", "processing"), true);
  assert.equal(canTransitionOrder("cancelled", "shipped"), false);
});
