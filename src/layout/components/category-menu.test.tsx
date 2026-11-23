import { describe, expect, it } from "vitest";

import { buildCategoryMenuItems } from "./category-menu";

describe("buildCategoryMenuItems", () => {
  it("keeps root categories and nested links in a stable display order", () => {
    const items = buildCategoryMenuItems([
      { _id: "child-2", parentId: "root", path: "teas/mint", name: "نعناع" },
      { _id: "root", parentId: null, path: "teas", name: "دمنوش‌ها" },
      { _id: "child-1", parentId: "root", path: "teas/rose", name: "گل سرخ" },
    ] as never);

    expect(items).toEqual([
      {
        id: "root",
        label: "دمنوش‌ها",
        href: "/store/teas",
        icon: "tea",
        children: [
          { id: "child-2", label: "نعناع", href: "/store/teas/mint", icon: "tea" },
          { id: "child-1", label: "گل سرخ", href: "/store/teas/rose", icon: "tea" },
        ],
      },
    ]);
  });
});
