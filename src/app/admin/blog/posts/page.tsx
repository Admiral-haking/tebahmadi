import { Container } from "@mui/material";

import BlogPostsAdminView, { type BlogPostStatus } from "@/views/admin/blog/posts";
import { buildAdminMetadata } from "@/lib/admin-metadata";

const PAGE_TITLE = "مدیریت نوشته‌های وبلاگ";

type SearchParams = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value ?? undefined;
}

function parseStatuses(raw: string | string[] | undefined): BlogPostStatus[] | undefined {
  const value = firstValue(raw);
  if (!value) return undefined;
  const parts = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean) as BlogPostStatus[];
  const allowed = new Set<BlogPostStatus>(["draft", "published", "archived"]);
  const result = parts.filter((status) => allowed.has(status));
  return result.length > 0 ? result : undefined;
}

function toPageNumber(value: string | undefined): number {
  if (!value) return 1;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? 1 : parsed;
}

export async function generateMetadata() {
  return buildAdminMetadata(PAGE_TITLE);
}

export default async function Page({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const resolvedSearchParams = await searchParams;
  const pageNumber = toPageNumber(firstValue(resolvedSearchParams?.page));
  const q = firstValue(resolvedSearchParams?.q);
  const categoryId = firstValue(resolvedSearchParams?.category);
  const subtreeParam = firstValue(resolvedSearchParams?.subtree);
  const includeSubtree = subtreeParam === "1" || subtreeParam === "true";
  const statuses = parseStatuses(resolvedSearchParams?.status);

  return (
    <Container maxWidth="lg" sx={{ py: 0 }}>
      <BlogPostsAdminView
        page={pageNumber}
        q={q}
        status={statuses}
        categoryId={categoryId}
        includeSubtree={includeSubtree}
      />
    </Container>
  );
}
