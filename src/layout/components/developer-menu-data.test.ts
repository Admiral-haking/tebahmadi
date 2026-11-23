import { describe, expect, it } from "vitest";
import { DEVELOPER_MENU_ITEMS, isDeveloperMenuHref } from "./developer-menu-data";

describe("developer menu", () => {
  it("keeps sensitive payment and error tools out of the main admin menu", () => {
    expect(DEVELOPER_MENU_ITEMS.map((item) => item.href)).toEqual([
      "/admin/payment-quality",
      "/admin/payment-gateways",
      "/admin/error-logs",
    ]);
    expect(isDeveloperMenuHref("/admin/payment-quality")).toBe(true);
    expect(isDeveloperMenuHref("/admin/payment-gateways")).toBe(true);
    expect(isDeveloperMenuHref("/admin/error-logs")).toBe(true);
    expect(isDeveloperMenuHref("/admin/orders")).toBe(false);
  });
});
