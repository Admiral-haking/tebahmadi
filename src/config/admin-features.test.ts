import { describe, expect, it } from "vitest";
import {
  disabledAdminFeatureForApiPath,
  disabledAdminFeatureForPath,
  isAdminFeatureEnabled,
  MARKETPLACE_INTEGRATIONS_ENABLED,
} from "./admin-features";

describe("admin feature switches", () => {
  it("keeps the requested admin integrations disabled", () => {
    expect(isAdminFeatureEnabled("digikala")).toBe(false);
    expect(isAdminFeatureEnabled("snapp")).toBe(false);
    expect(isAdminFeatureEnabled("basalaam")).toBe(false);
    expect(isAdminFeatureEnabled("marketplaceHealth")).toBe(false);
    expect(isAdminFeatureEnabled("inventoryComparison")).toBe(false);
    expect(isAdminFeatureEnabled("help")).toBe(false);
    expect(isAdminFeatureEnabled("holoo")).toBe(false);
    expect(MARKETPLACE_INTEGRATIONS_ENABLED).toBe(false);
  });

  it("matches nested admin routes and integration APIs", () => {
    expect(disabledAdminFeatureForPath("/admin/snapp/vendor-1/branch-2")).toBe("snapp");
    expect(disabledAdminFeatureForPath("/admin/holoo")).toBe("holoo");
    expect(disabledAdminFeatureForApiPath("/api/basalaam/webhook")).toBe("basalaam");
    expect(disabledAdminFeatureForApiPath("/api/admin/inventory-comparison")).toBe("inventoryComparison");
    expect(disabledAdminFeatureForApiPath("/api/catalog/products")).toBeNull();
  });
});
