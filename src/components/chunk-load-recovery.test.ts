import { describe, expect, it } from "vitest";

import { isChunkLoadError } from "./chunk-load-recovery";

describe("chunk load recovery", () => {
  it("recognizes dynamic chunk failures without matching ordinary errors", () => {
    expect(isChunkLoadError(new Error("Loading chunk 4631 failed"))).toBe(true);
    expect(isChunkLoadError({ name: "ChunkLoadError", message: "Loading CSS chunk failed" })).toBe(true);
    expect(isChunkLoadError(new Error("دریافت داده‌های داشبورد ناموفق بود"))).toBe(false);
    expect(isChunkLoadError("خطای اعتبارسنجی فرم")).toBe(false);
  });
});
