import { describe, expect, it } from "vitest";

import type { BlogPostListItem } from "../../blog/data";
import { formatBlogPostAge, getBlogCoverImage, selectHomeBlogPosts } from "./blog-helpers";

function makePost(overrides: Partial<BlogPostListItem> = {}): BlogPostListItem {
  return {
    id: "post-1",
    slug: "post-1",
    title: "مقاله آزمایشی",
    excerpt: "خلاصه مقاله",
    publishedAt: "2026-11-20T12:00:00.000Z",
    coverImageUrl: "https://example.com/post.webp",
    tags: [],
    categories: [],
    ...overrides,
  };
}

describe("home blog helpers", () => {
  it("keeps at most three complete published posts and removes incomplete records", () => {
    const posts = [
      makePost({ id: "first", slug: "first", title: "اول" }),
      makePost({ id: "missing-slug", slug: "", title: "بدون مسیر" }),
      makePost({ id: "second", slug: "second", title: "دوم" }),
      makePost({ id: "third", slug: "third", title: "سوم" }),
      makePost({ id: "fourth", slug: "fourth", title: "چهارم" }),
    ];

    expect(selectHomeBlogPosts(posts).map((post) => post.id)).toEqual(["first", "second", "third"]);
  });

  it("formats relative dates with Persian numerals and uses a safe image placeholder", () => {
    const now = new Date("2026-11-23T12:00:00.000Z");

    expect(formatBlogPostAge("2026-11-20T12:00:00.000Z", now)).toBe("۳ روز پیش");
    expect(formatBlogPostAge("not-a-date", now)).toBeNull();
    expect(getBlogCoverImage(makePost({ coverImageUrl: " " }))).toBe("/product-placeholder.svg");
  });
});
