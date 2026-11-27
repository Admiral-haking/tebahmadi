import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/image", () => ({
  default: ({ src, alt, sizes }: { src: string; alt: string; sizes?: string }) => (
    <img src={src} alt={alt} sizes={sizes} />
  ),
}));

vi.mock("@/components/cart/useCart", () => ({
  useCart: () => ({
    addFixedLine: vi.fn(),
    addPerUnitLine: vi.fn(),
    lines: [],
  }),
}));

vi.mock("@mui/material", async () => {
  const actual = await vi.importActual<typeof import("@mui/material")>("@mui/material");
  return {
    ...actual,
    useMediaQuery: () => true,
    useTheme: () => ({ breakpoints: { down: () => "md" } }),
  };
});

import ProductDetailClient from "./view.client";

describe("ProductDetailClient responsive purchase shell", () => {
  it("keeps the primary media bounded and the mobile purchase bar safe", () => {
    const markup = renderToStaticMarkup(
      <ProductDetailClient
        product={{
          id: "product-1",
          slug: "sample",
          title: "روغن گیاهی نمونه",
          description: "توضیح کوتاه محصول",
          categories: [],
          productFacts: [],
          variants: [
            {
              id: "variant-1",
              sku: "SKU-1",
              priceModel: "fixed",
              unitPrice: 120000,
              finalPrice: 120000,
              inventoryQuantity: 4,
              inventoryTrackingUnit: "unit",
              attributes: [],
              attributesSummary: "",
              attributeEntries: [],
              variantAttributeValues: {},
              media: [],
            },
          ],
          activeVariantCount: 1,
          hasInventory: true,
          variantAttributes: [],
          reviews: [],
        }}
      />,
    );

    expect(markup).toContain('sizes="(max-width: 600px) 92vw, (max-width: 900px) 48vw, 540px"');
    expect(markup).toContain("env(safe-area-inset-bottom)");
    expect(markup).toContain("افزودن به سبد خرید");
    expect(markup).toContain("تعداد");
  });
});
