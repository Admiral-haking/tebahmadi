import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import MegaButton from "./mega-button";

describe("MegaButton", () => {
  it("links directly to the store without relying on hidden DOM controls", () => {
    const markup = renderToStaticMarkup(<MegaButton />);

    expect(markup).toContain('href="/store"');
    expect(markup).toContain("همه محصولات");
  });
});
