import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return readFileSync(new URL(`../../${relativePath}`, import.meta.url), "utf8");
}

describe("brand icon storefront integrations", () => {
  it("uses the brand family for trust signals", () => {
    const source = read("views/home/components/trust-bar.tsx");

    expect(source).toContain("BrandIcon");
    expect(source).toContain('name="shipping"');
    expect(source).toContain('name="authenticity"');
    expect(source).toContain('name="support"');
    expect(source).toContain('name="payment"');
    expect(source).not.toContain("<svg");
  });

  it("uses the brand family for customer actions", () => {
    const files = [
      read("layout/core/desktop-header.tsx"),
      read("layout/core/mobile-header.tsx"),
      read("layout/components/cart-button.tsx"),
      read("layout/components/user-button.tsx"),
    ].join("\n");

    expect(files).toContain("BrandIcon");
    expect(files).toContain('name="support"');
    expect(files).toContain('name="info"');
    expect(files).toContain('name="cart"');
    expect(files).toContain('name="account"');
    expect(files).toContain('name="orders"');
  });

  it("connects the mounted search box and mobile navigation", () => {
    const searchBox = read("components/search/index.tsx");
    const headers = [
      read("layout/core/desktop-header.tsx"),
      read("layout/core/mobile-header.tsx"),
    ].join("\n");
    const mobileNav = read("components/ui/MobileBottomNav.tsx");

    expect(searchBox).toContain("leadingIcon");
    expect(headers).toContain("leadingIcon");
    expect(mobileNav).toContain("BrandIcon");
    expect(mobileNav).toContain('icon: "home"');
    expect(mobileNav).toContain('icon: "store"');
    expect(mobileNav).toContain('icon: "cart"');
    expect(mobileNav).toContain('icon: user ? "orders" : "account"');
  });
});
