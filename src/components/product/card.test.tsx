import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("../image", () => ({
  default: ({
    alt,
    loading,
    fetchPriority,
    sizes,
    priority,
  }: {
    alt: string;
    loading?: string;
    fetchPriority?: string;
    sizes?: string;
    priority?: boolean;
  }) => (
    <span
      data-image
      data-loading={loading}
      data-fetch-priority={fetchPriority}
      data-sizes={sizes}
      data-priority={String(Boolean(priority))}
    >
      {alt}
    </span>
  ),
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
    expect(markup).toContain("مشاهده و انتخاب");
    expect(markup).not.toContain("opacity:0");
    expect(markup).toContain('data-loading="lazy"');
    expect(markup).toContain('data-fetch-priority="auto"');
    expect(markup).toContain('data-sizes="(max-width: 600px) 46vw, (max-width: 900px) 30vw, 260px"');
    expect(markup).toContain('data-priority="false"');
  });

  it("allows the explicitly selected above-the-fold card image to be prioritized", () => {
    const markup = renderToStaticMarkup(
      <ProductCard
        id="p1"
        slug="sample"
        title="روغن گیاهی نمونه"
        finalPrice={120000}
        inStock
        priorityImage
      />,
    );

    expect(markup).toContain('data-fetch-priority="high"');
    expect(markup).toContain('data-priority="true"');
    expect(markup).not.toContain('data-loading="lazy"');
  });

  it("accepts a caller-specific image size for wider carousels", () => {
    const markup = renderToStaticMarkup(
      <ProductCard
        id="p1"
        slug="sample"
        title="روغن گیاهی نمونه"
        finalPrice={120000}
        inStock
        imageSizes="(max-width: 600px) 78vw, 240px"
      />,
    );

    expect(markup).toContain('data-sizes="(max-width: 600px) 78vw, 240px"');
  });
});
