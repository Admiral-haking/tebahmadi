import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CategoryTile, getCategoryDisplayName } from "./categories";

describe("home category visual identity", () => {
  it("uses the Tab Ahmadi brand icon family for category tiles", () => {
    const source = readFileSync(new URL("./categories.tsx", import.meta.url), "utf8");

    expect(source).toContain("BrandIcon");
    expect(source).toContain("resolveBrandIconName");
    expect(source).not.toContain("<OptimizedImage");
  });

  it("keeps media-less categories named and linked with the generic icon", () => {
    const markup = renderToStaticMarkup(
      <CategoryTile
        category={{
          id: "cat-cardamom",
          name: "",
          slug: "cardamom",
          path: "cardamom",
          depth: 0,
          parentId: null,
          mediaId: null,
        }}
      />,
    );

    expect(getCategoryDisplayName("", "cardamom")).toBe("دسته‌بندی cardamom");
    expect(markup).toContain('href="/store/cardamom"');
    expect(markup).toContain('data-brand-icon="category"');
    expect(markup).toContain("دسته‌بندی cardamom");
  });
});
