import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("../image", () => ({
  default: ({ alt }: { alt: string }) => <span data-image>{alt}</span>,
}));

import { ProductCard } from "./card";

describe("ProductCard", () => {
  it("is visible in server-rendered HTML before client JavaScript runs", () => {
    const markup = renderToStaticMarkup(
      <ProductCard
        id="p1"
        slug="sample"
        title="روغن گیاهی نمونه"
        finalPrice={120000}
        inStock
      />,
    );

    expect(markup).toContain("روغن گیاهی نمونه");
    expect(markup).toContain("افزودن به سبد");
    expect(markup).not.toContain("opacity:0");
  });
});
