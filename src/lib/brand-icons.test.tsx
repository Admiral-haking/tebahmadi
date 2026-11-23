import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { BrandIcon } from "@/components/brand-icons";
import { resolveBrandIconName } from "./brand-icons";

describe("Tab Ahmadi brand icons", () => {
  it("maps product category labels and legacy preview keys to the right icon", () => {
    expect(resolveBrandIconName("روغن‌های گیاهی", "natural-oils")).toBe("oils");
    expect(resolveBrandIconName("دمنوش‌های طبیعی", "cup")).toBe("tea");
    expect(resolveBrandIconName("گیاهان دارویی", "medicinal-herbs")).toBe("herbs");
    expect(resolveBrandIconName("محصولات تازه", "new-category")).toBe("category");
    expect(resolveBrandIconName("هل", "cardamom")).toBe("category");
    expect(resolveBrandIconName("ضد آفتاب", "sunscreen")).toBe("category");
    expect(resolveBrandIconName("محصولات تازه", "constructor")).toBe("category");
  });

  it("renders an inheritable SVG with optional accessible title and size", () => {
    const markup = renderToStaticMarkup(<BrandIcon name="herbs" size={32} />);
    const titledMarkup = renderToStaticMarkup(<BrandIcon name="support" size="1em" title="پشتیبانی" />);

    expect(markup).toContain('viewBox="0 0 24 24"');
    expect(markup).toContain('width="32"');
    expect(markup).toContain('height="32"');
    expect(markup).toContain('stroke="currentColor"');
    expect(markup).toContain('aria-hidden="true"');
    expect(titledMarkup).toContain("<title>پشتیبانی</title>");
    expect(titledMarkup).toContain('width="1em"');
  });
});
