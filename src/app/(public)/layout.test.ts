import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("public chat widget integration", () => {
  it("loads the Dartamas widget without the Goftino loader", () => {
    const source = readFileSync(new URL("./layout.tsx", import.meta.url), "utf8");

    expect(source).toContain('id="dartamas-chat-widget"');
    expect(source).toContain("https://my.dartamas.com/chatButtonModule.js?t=");
    expect(source).toContain("script.setAttribute('data-url', 'sipOnline')");
    expect(source).toContain("script.setAttribute('data-no-minify', '1')");
    expect(source).toContain("script.setAttribute('data-nowprocket', '1')");
    expect(source).toContain("script.setAttribute('data-no-defer', '1')");
    expect(source).toContain("script.setAttribute('data-cfasync', 'false')");
    expect(source).toContain("script.setAttribute('data-noptimize', '1')");
    expect(source).toContain("script.setAttribute('data-pagespeed-no-defer', '')");
    expect(source.toLowerCase()).not.toContain("goftino");
    expect(existsSync(new URL("../../../public/goftino.js", import.meta.url))).toBe(false);
  });
});
