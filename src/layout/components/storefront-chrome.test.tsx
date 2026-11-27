import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AnnouncementBar, MobileBottomNav } from "./storefront-chrome";
import { criticalLayoutCss } from "../critical-layout-css";

describe("storefront chrome", () => {
  it("renders a useful announcement with a store call to action", () => {
    const markup = renderToStaticMarkup(<AnnouncementBar />);

    expect(markup).toContain("پیشنهادهای تازه طب احمدی");
    expect(markup).toContain('href="/store"');
    expect(markup).toContain("teb-announcement");
  });

  it("provides the four primary mobile destinations", () => {
    const markup = renderToStaticMarkup(<MobileBottomNav />);

    expect(markup).toContain('href="/"');
    expect(markup).toContain('href="/store"');
    expect(markup).toContain('href="/cart"');
    expect(markup).toContain('href="/orders"');
  });

  it("keeps responsive header visibility safe before component styles hydrate", () => {
    expect(criticalLayoutCss).toContain(".teb-desktop-header");
    expect(criticalLayoutCss).toContain(".teb-mobile-header");
    expect(criticalLayoutCss).toContain("@media (min-width: 900px)");
    expect(criticalLayoutCss).toContain("display: none");
  });
});
