import { describe, expect, it } from "vitest";

import { getVisibleSocialLinks } from "./social-follow-banner";

describe("getVisibleSocialLinks", () => {
  it("keeps configured supported platforms and hides non-platform entries", () => {
    const links = getVisibleSocialLinks([
      { platform: "telegram", url: " https://t.me/tebahmadi " },
      { platform: "globalAddress", url: "@tebahmadi" },
      { platform: "instagram", url: "" },
      { platform: "unknown", url: "https://example.com" },
      { platform: "baleh", url: "https://ble.ir/tebahmadi" },
    ]);

    expect(links).toEqual([
      { platform: "telegram", url: "https://t.me/tebahmadi", label: "کانال تلگرام" },
      { platform: "baleh", url: "https://ble.ir/tebahmadi", label: "کانال بله" },
    ]);
  });

  it("does not render the banner data when no usable platform is configured", () => {
    expect(
      getVisibleSocialLinks([
        { platform: "globalAddress", url: "@tebahmadi" },
        { platform: "instagram", url: "javascript:alert(1)" },
      ]),
    ).toEqual([]);
  });
});
