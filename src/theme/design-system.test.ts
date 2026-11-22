import { describe, expect, it } from "vitest";

import { brandTokens, responsiveContainer } from "./design-system";

describe("Tab Ahmadi design system", () => {
  it("exposes the approved botanical brand palette", () => {
    expect(brandTokens.color.primary).toBe("#6D7D45");
    expect(brandTokens.color.accent).toBe("#B49A68");
    expect(brandTokens.color.canvas).toBe("#FBFBF8");
    expect(brandTokens.color.text).toBe("#2F3428");
  });

  it("uses a predictable 4px spacing and restrained radius scale", () => {
    expect(brandTokens.space(1)).toBe(4);
    expect(brandTokens.space(6)).toBe(24);
    expect(brandTokens.radius.card).toBe(16);
    expect(brandTokens.radius.control).toBe(10);
  });

  it("keeps the storefront readable on small and large screens", () => {
    expect(responsiveContainer).toEqual({
      xs: "calc(100% - 24px)",
      sm: "calc(100% - 40px)",
      lg: 1200,
    });
  });
});
