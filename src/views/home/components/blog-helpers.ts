import type { BlogPostListItem } from "../../blog/data";

const HOME_BLOG_LIMIT = 3;
const BLOG_PLACEHOLDER = "/product-placeholder.svg";

const RELATIVE_TIME_UNITS = [
  { unit: "year" as const, milliseconds: 365 * 24 * 60 * 60 * 1000 },
  { unit: "month" as const, milliseconds: 30 * 24 * 60 * 60 * 1000 },
  { unit: "week" as const, milliseconds: 7 * 24 * 60 * 60 * 1000 },
  { unit: "day" as const, milliseconds: 24 * 60 * 60 * 1000 },
  { unit: "hour" as const, milliseconds: 60 * 60 * 1000 },
  { unit: "minute" as const, milliseconds: 60 * 1000 },
] as const;

export function selectHomeBlogPosts(posts: readonly BlogPostListItem[]): BlogPostListItem[] {
  return posts
    .filter((post) => post.slug.trim().length > 0 && post.title.trim().length > 0)
    .slice(0, HOME_BLOG_LIMIT);
}

export function formatBlogPostAge(value: string | null, now = new Date()): string | null {
  if (!value) {
    return null;
  }

  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    return null;
  }

  const difference = timestamp - now.getTime();
  if (Math.abs(difference) < 60 * 1000) {
    return "همین حالا";
  }

  const formatter = new Intl.RelativeTimeFormat("fa-IR", { numeric: "always" });
  const unit = RELATIVE_TIME_UNITS.find(({ milliseconds }) => Math.abs(difference) >= milliseconds);
  if (!unit) {
    return formatter.format(Math.round(difference / 1000), "second");
  }

  return formatter.format(Math.round(difference / unit.milliseconds), unit.unit);
}

export function getBlogCoverImage(post: Pick<BlogPostListItem, "coverImageUrl">): string {
  const imageUrl = post.coverImageUrl?.trim();
  return imageUrl || BLOG_PLACEHOLDER;
}
