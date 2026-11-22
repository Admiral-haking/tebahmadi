import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import BrandLockup from "./index";

describe("BrandLockup", () => {
  it("renders a complete local brand lockup without depending on CMS media", () => {
    const markup = renderToStaticMarkup(<BrandLockup />);

    expect(markup).toContain('src="/tebahmadi-mark.svg"');
    expect(markup).toContain("طب احمدی");
    expect(markup).toContain("aria-label=\"طب احمدی\"");
  });
});
