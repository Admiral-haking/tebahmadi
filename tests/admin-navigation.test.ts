import assert from "node:assert/strict";
import test from "node:test";
import { getAdminNavigation } from "../lib/admin-navigation";

test("owner navigation exposes grouped commerce operations and user management", () => {
  const sections = getAdminNavigation("owner", 3);
  const items = sections.flatMap((section) => section.items);

  assert.deepEqual(sections.map((section) => section.label), ["فروش", "کاتالوگ", "عملیات", "ارتباط", "سیستم"]);
  assert.ok(items.some((item) => item.id === "dashboard"));
  assert.ok(items.some((item) => item.id === "operations" && item.href === "/admin/order-center"));
  assert.ok(items.some((item) => item.id === "users" && item.label === "کاربران و نقش‌ها"));
  assert.equal(items.find((item) => item.id === "support")?.badge, "۳");
});

test("support navigation does not expose sensitive catalog, inventory, finance, or user mutations", () => {
  const items = getAdminNavigation("support", 0).flatMap((section) => section.items);
  const ids = items.map((item) => item.id);

  assert.deepEqual(ids, ["dashboard", "orders", "returns", "contacts", "support"]);
  assert.equal(items.find((item) => item.id === "support")?.badge, undefined);
});
