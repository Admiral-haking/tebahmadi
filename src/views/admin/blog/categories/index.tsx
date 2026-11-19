'use client';

import Link from "next/link";
import { useMemo } from "react";
import useSWR from "swr";
import { Alert, Box, Button, Container, Stack, Typography } from "@mui/material";

import SearchBox from "@/components/search";
import Splash from "@/components/splash";

import CategoriesTable from "./components/category-table";

export type BlogCategoryListItem = {
  id: string;
  name: string;
  slug: string;
  path: string;
  depth: number;
  parentId?: string | null;
  isActive: boolean;
  position?: number;
  childCount: number;
  postCount: number;
  updatedAt?: string;
};

export default function BlogCategoriesAdminView({ q }: { q?: string }) {
  const endpoint = useMemo(() => {
    const params = new URLSearchParams();
    if (q && q.trim()) {
      params.set("q", q.trim());
    }
    const search = params.toString();
    return `/api/admin/blog/categories${search ? `?${search}` : ""}`;
  }, [q]);

  const { data, error, isLoading } = useSWR<{ categories: BlogCategoryListItem[] }>(endpoint, async (url: string) => {
    const response = await fetch(url, { credentials: "include" });
    if (!response.ok) {
      const message = (await response.text().catch(() => "")) || response.statusText;
      throw new Error(message);
    }
    return response.json();
  });

  if (isLoading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Splash />
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="error">
          {(error instanceof Error ? error.message : "خطا در دریافت داده‌ها")}
        </Alert>
      </Container>
    );
  }

  const list = data?.categories ?? [];

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Stack spacing={4}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", sm: "center" }}
        >
          <Stack spacing={1}>
            <Typography variant="h4" fontWeight={800}>
              مدیریت دسته‌های وبلاگ
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {list.length.toLocaleString("fa-IR")} دسته وبلاگ ثبت شده است و امکان گروه‌بندی چندسطحی
              برای پوشش تمام موضوعات فراهم است. برای مدیریت دقیق‌تر می‌توانید جستجو یا دسته جدیدی
              ایجاد کنید.
            </Typography>
          </Stack>
          <Button
            LinkComponent={Link}
            href="/admin/blog/categories/save"
            variant="contained"
            size="large"
            sx={{ borderRadius: 3, px: 3.5, py: 1.25 }}
          >
            دسته جدید
          </Button>
        </Stack>

        <Box>
          <SearchBox
            onSearchUrl="/admin/blog/categories"
            alwaysShowSearch
            placeholder="جستجوی عنوان، اسلاگ یا مسیر..."
            value={q ?? ""}
          />
        </Box>

        <CategoriesTable categories={list} />
      </Stack>
    </Container>
  );
}
