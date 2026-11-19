'use client';

import { useMemo } from "react";
import useSWR from "swr";
import { Alert, Button, Card, CardContent, Container, Divider, Stack, Typography } from "@mui/material";

import Link from "next/link";
import SearchBox from "@/components/search";
import Splash from "@/components/splash";

import PostsTable from "./components/posts-table";
import PostsFilters from "./components/posts-filters";

import type { BlogPostDocument } from "@/content/models/BlogPost";

export type BlogPostStatus = BlogPostDocument["status"];

export type BlogCategoryFilterOption = {
  id: string;
  name: string;
  path: string;
  depth: number;
};

export type BlogPostListItem = {
  id: string;
  title: string;
  slug: string;
  status: BlogPostStatus;
  excerpt?: string | null;
  categories: Array<{ id: string; name: string; path: string }>;
  tags: string[];
  coverImageId?: string;
  authorId?: string;
  publishedAt?: string | null;
  updatedAt?: string | null;
  createdAt?: string | null;
};

interface BlogPostsAdminViewProps {
  page?: number;
  q?: string | null;
  status?: BlogPostStatus[];
  categoryId?: string | null;
  includeSubtree?: boolean;
}

type PostsApiResponse = {
  posts: BlogPostListItem[];
  total: number;
  page: number;
  pages: number;
  statusCounts: Record<BlogPostStatus, number>;
  categoryOptions: BlogCategoryFilterOption[];
};

const fetcher = async (url: string): Promise<PostsApiResponse> => {
  const response = await fetch(url, { credentials: "include" });
  if (!response.ok) {
    const message = (await response.text().catch(() => "")) || response.statusText;
    throw new Error(message);
  }
  return response.json();
};

export default function BlogPostsAdminView({
  page = 1,
  q,
  status,
  categoryId,
  includeSubtree,
}: BlogPostsAdminViewProps) {
  const endpoint = useMemo(() => {
    const params = new URLSearchParams();
    if (page && page > 1) {
      params.set("page", page.toString());
    }
    if (q && q.trim()) {
      params.set("q", q.trim());
    }
    if (status && status.length > 0) {
      params.set("status", status.join(","));
    }
    if (categoryId) {
      params.set("category", categoryId);
    }
    if (includeSubtree) {
      params.set("subtree", "1");
    }
    const query = params.toString();
    return `/api/admin/blog/posts${query ? `?${query}` : ""}`;
  }, [categoryId, includeSubtree, page, q, status]);

  const { data, error, isLoading } = useSWR(endpoint, fetcher, {
    keepPreviousData: true,
  });

  if (isLoading) {
    return (
      <Container maxWidth="lg" sx={{ py: 6 }}>
        <Splash />
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="lg" sx={{ py: 6 }}>
        <Alert severity="error">
          {(error instanceof Error ? error.message : "خطا در دریافت داده‌ها")}
        </Alert>
      </Container>
    );
  }

  const posts = data?.posts ?? [];
  const total = data?.total ?? 0;
  const pageNumber = data?.page ?? page ?? 1;
  const totalPages = data?.pages ?? 1;
  const statusCounts = data?.statusCounts ?? { draft: 0, published: 0, archived: 0 };
  const categories = data?.categoryOptions ?? [];

  return (
    <Container maxWidth="lg" sx={{ py: 6 }}>
      <Stack spacing={4}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", md: "center" }}
          spacing={2}
        >
          <Stack spacing={1}>
            <Typography variant="h4" fontWeight={800}>
              مدیریت نوشته‌های وبلاگ
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {total.toLocaleString("fa-IR")} نوشته در سیستم ثبت شده است. می‌توانید بر اساس وضعیت،
              دسته یا متن جستجو موارد دلخواه را بیابید.
            </Typography>
          </Stack>
          <Button
            LinkComponent={Link}
            href="/admin/blog/posts/save"
            variant="contained"
            size="large"
            sx={{ borderRadius: 3, px: 3.5, py: 1.25 }}
          >
            نوشته جدید
          </Button>
        </Stack>

        <Card variant="outlined" sx={{ borderRadius: 4 }}>
          <CardContent>
            <Stack spacing={3}>
              <Stack
                direction={{ xs: "column", md: "row" }}
                spacing={2}
                alignItems={{ xs: "flex-start", md: "center" }}
                justifyContent="space-between"
              >
                <SearchBox
                  onSearchUrl="/admin/blog/posts"
                  alwaysShowSearch
                  placeholder="جستجوی عنوان یا محتوا..."
                  value={q ?? ""}
                />
                <PostsFilters
                  statusCounts={statusCounts}
                  selectedStatuses={status ?? []}
                  categories={categories}
                  selectedCategory={categoryId ?? null}
                  includeSubtree={Boolean(includeSubtree)}
                />
              </Stack>
              <Divider />
              <PostsTable items={posts} page={pageNumber} pages={totalPages} total={total} />
            </Stack>
          </CardContent>
        </Card>
      </Stack>
    </Container>
  );
}
