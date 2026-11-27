import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("./useCart", () => ({
  useCart: () => ({
    updateQty: vi.fn(),
    updateRequestedQty: vi.fn(),
    removeLine: vi.fn(),
    saveForLater: vi.fn(),
    moveSavedToCart: vi.fn(),
    removeSavedLine: vi.fn(),
  }),
}));

vi.mock("@/components/image", () => ({
  default: ({ src, alt, loading, sizes }: { src: string; alt: string; loading?: string; sizes?: string }) => (
    <img data-product-image="true" src={src} alt={alt} loading={loading} sizes={sizes} />
  ),
}));

import CartLineItem from "./CartLineItem";

describe("CartLineItem", () => {
  it("keeps cart information readable while using a lazy optimized thumbnail", () => {
    const markup = renderToStaticMarkup(
      <CartLineItem
        line={{
          productId: "product-1",
          productSlug: "sample",
          title: "روغن گیاهی نمونه",
          variantId: "variant-1",
          sku: "SKU-1",
          priceModel: "fixed",
          qty: 1,
          unitPriceBase: 120000,
          mediaThumbId: "thumb-1",
          attributesSummary: "۶۰ میلی‌لیتر",
        }}
      />,
    );

    expect(markup).toContain("روغن گیاهی نمونه");
    expect(markup).toContain("افزایش تعداد");
    expect(markup).toContain('data-product-image="true"');
    expect(markup).toContain('loading="lazy"');
    expect(markup).toContain('sizes="96px"');
  });
});
