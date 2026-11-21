import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("admin runtime boundary", () => {
  it("keeps database-backed admin pages out of static prerendering", () => {
    const source = readFileSync(new URL("./layout.tsx", import.meta.url), "utf8");

    expect(source).toContain('export const dynamic = "force-dynamic"');
  });
});
