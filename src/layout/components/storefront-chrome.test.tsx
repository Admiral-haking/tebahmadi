import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AnnouncementBar, MobileBottomNav } from "./storefront-chrome";

describe("storefront chrome", () => {
  it("renders a useful announcement with a store call to action", () => {
    const markup = renderToStaticMarkup(<AnnouncementBar />);

    expect(markup).toContain("پست پیشتاز");
    expect(markup).toContain('href="/store"');
  });

  it("provides the four primary mobile destinations", () => {
    const markup = renderToStaticMarkup(<MobileBottomNav />);

    expect(markup).toContain('href="/"');
    expect(markup).toContain('href="/store"');
    expect(markup).toContain('href="/cart"');
    expect(markup).toContain('href="/orders"');
  });
});
