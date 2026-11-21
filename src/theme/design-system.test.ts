import { describe, expect, it } from "vitest";

import { brandTokens, responsiveContainer } from "./design-system";

describe("Tab Ahmadi design system", () => {
  it("exposes the approved botanical brand palette", () => {
    expect(brandTokens.color.primary).toBe("#2A5A44");
    expect(brandTokens.color.accent).toBe("#C5A059");
    expect(brandTokens.color.canvas).toBe("#F9F8F6");
    expect(brandTokens.color.text).toBe("#222222");
  });

  it("uses a predictable 4px spacing and restrained radius scale", () => {
    expect(brandTokens.space(1)).toBe(4);
    expect(brandTokens.space(6)).toBe(24);
    expect(brandTokens.radius.card).toBe(24);
    expect(brandTokens.radius.control).toBe(16);
  });

  it("keeps the storefront readable on small and large screens", () => {
    expect(responsiveContainer).toEqual({
      xs: "calc(100% - 24px)",
      sm: "calc(100% - 40px)",
      lg: 1200,
    });
  });
});
