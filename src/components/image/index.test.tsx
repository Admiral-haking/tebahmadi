import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/image", () => ({
  default: ({ fill: _fill, priority: _priority, ...props }: React.ImgHTMLAttributes<HTMLImageElement> & {
    fill?: boolean;
    priority?: boolean;
  }) => <img {...props} />,
}));

import OptimizedImage from ".";

describe("OptimizedImage", () => {
  it("keeps lazy images visible during the first server-rendered paint", () => {
    const markup = renderToStaticMarkup(
      <OptimizedImage
        src="/api/media/thumb"
        alt="محصول نمونه"
        fill
        sizes="(max-width: 600px) 92vw, 420px"
      />,
    );

    expect(markup).toContain('loading="lazy"');
    expect(markup).toContain('decoding="async"');
    expect(markup).toContain('sizes="(max-width: 600px) 92vw, 420px"');
    expect(markup).not.toContain("opacity:0");
  });

  it("keeps high fetch priority for the explicitly prioritized image", () => {
    const markup = renderToStaticMarkup(
      <OptimizedImage
        src="/api/media/original"
        alt="تصویر اصلی"
        fill
        priority
        sizes="540px"
      />,
    );

    expect(markup).toContain('fetchPriority="high"');
    expect(markup).not.toContain('loading="lazy"');
  });

  it("uses the product placeholder for an empty source", () => {
    const markup = renderToStaticMarkup(
      <OptimizedImage src="" alt="محصول بدون تصویر" width={120} height={120} />,
    );

    expect(markup).toContain('src="/product-placeholder.svg"');
  });
});
