import { describe, expect, it } from "vitest";

import { selectDiscountProducts } from "./discount-selection";

describe("home discount products", () => {
  it("keeps only in-stock products with a real discount", () => {
    const products = selectDiscountProducts([
      {
        id: "discounted",
        slug: "discounted",
        title: "محصول تخفیف‌دار",
        finalPrice: 80,
        originalPrice: 100,
        discountPercent: 20,
        inStock: true,
      },
      {
        id: "full-price",
        slug: "full-price",
        title: "محصول بدون تخفیف",
        finalPrice: 100,
        originalPrice: 100,
        inStock: true,
      },
      {
        id: "out-of-stock",
        slug: "out-of-stock",
        title: "محصول ناموجود",
        finalPrice: 70,
        originalPrice: 100,
        discountPercent: 30,
        inStock: false,
      },
    ]);

    expect(products.map((product) => product.id)).toEqual(["discounted"]);
  });

  it("does not manufacture preview products when the database has no offers", () => {
    expect(selectDiscountProducts([])).toEqual([]);
  });
});
