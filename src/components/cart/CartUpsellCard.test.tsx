import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/image", () => ({
  default: ({ src, alt, loading, sizes }: { src: string; alt: string; loading?: string; sizes?: string }) => (
    <img data-product-image="true" src={src} alt={alt} loading={loading} sizes={sizes} />
  ),
}));

import CartUpsellCard, { type CartUpsellProduct } from "./CartUpsellCard";

describe("CartUpsellCard", () => {
  it("uses a lazy fixed-size product image and a quick-add action", () => {
    const product: CartUpsellProduct = {
      id: "product-2",
      slug: "sample-2",
      title: "دمنوش گیاهی نمونه",
      finalPrice: 80000,
      inStock: true,
      imageUrl: "/api/media/thumb-2",
      line: {
        productId: "product-2",
        productSlug: "sample-2",
        title: "دمنوش گیاهی نمونه",
        variantId: "variant-2",
        sku: "SKU-2",
        priceModel: "fixed",
        unitPriceBase: 80000,
      },
    };

    const markup = renderToStaticMarkup(
      <CartUpsellCard product={product} isRecentlyAdded={false} onAdd={() => undefined} />,
    );

    expect(markup).toContain('data-product-image="true"');
    expect(markup).toContain('loading="lazy"');
    expect(markup).toContain('sizes="184px"');
    expect(markup).toContain("افزودن سریع به سبد");
  });
});
