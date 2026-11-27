import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/product", () => ({
  default: ({ title, priorityImage }: { title: string; priorityImage?: boolean }) => (
    <article data-product={title} data-priority={String(Boolean(priorityImage))} />
  ),
}));

vi.mock("@/components/search/pagination", () => ({
  default: () => <div data-pagination />,
}));

import StoreProductGridClient from "./grid-client";

describe("StoreProductGridClient", () => {
  it("prioritizes only the first product on the initial page", () => {
    const markup = renderToStaticMarkup(
      <StoreProductGridClient
        initialProducts={[
          { id: "p1", slug: "one", title: "محصول اول", finalPrice: 100, inStock: true },
          { id: "p2", slug: "two", title: "محصول دوم", finalPrice: 200, inStock: true },
        ]}
        initialPage={1}
        totalPages={1}
        initialQueryString=""
      />,
    );

    expect(markup).toContain('data-product="محصول اول" data-priority="true"');
    expect(markup).toContain('data-product="محصول دوم" data-priority="false"');
  });
});
