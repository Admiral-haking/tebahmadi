'use client';

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { Alert, Box, Button, Container, Stack, Typography } from "@mui/material";
import Link from "next/link";

import SearchBox from "@/components/search";
import Splash from "@/components/splash";

import CategoriesTable from "./components/categories-table";

export type CategoryListItem = {
  id: string;
  name: string;
  slug: string;
  path: string;
  depth: number;
  parentId?: string | null;
  isActive: boolean;
  position?: number;
  childCount: number;
  updatedAt?: string;
  productTypeId?: string | null;
  effectiveProductTypeId?: string | null;
  productTypeName?: string | null;
  productTypeInherited: boolean;
  imageId?: string | null;
  mediaId?: string | null;
};

export default function CategoriesAdminView({ q }: { q?: string }) {

  const [path, setPath] = useState<string[]>([]);

  const parentId = path[path.length - 1]

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (q && q.trim()) {
      params.set("q", q.trim());
    }

    params.set("parentId", parentId || "root");
    const search = params.toString();
    return `/api/admin/catalog/categories${search ? `?${search}` : ""}`;
  }, [q, parentId]);

  const { data, error, isLoading, mutate } = useSWR<{ categories: CategoryListItem[] }>(query, async (url: string) => {
    const response = await fetch(url, { credentials: "include" });
    if (!response.ok) {
      const message = (await response.text().catch(() => "")) || response.statusText;
      throw new Error(message);
    }
    return response.json();
  });
  useEffect(() => {
    mutate(); // re-fetch manually
  }, [parentId]);


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
      <Stack direction="row" alignItems="center" sx={{ mb: 4 }}>
        {
          !!parentId && <Button
            onClick={() => setPath(l => l.filter(x => x !== parentId))}
          >
            بازگشت
          </Button>
        }
        <Typography variant="h4">مدیریت دسته‌بندی‌ها</Typography>
        <Box flex="1 1 auto" />
        <Button LinkComponent={Link} href={`/admin/catalog/categories/save?parentId=${parentId}`} variant="contained">
          دسته‌بندی جدید
        </Button>
      </Stack>

      <Box sx={{ mb: 3 }}>
        <SearchBox onSearchUrl="/admin/catalog/categories" alwaysShowSearch value={q ?? ""} />
      </Box>

      <CategoriesTable
        categories={list}
        onOpen={id => setPath(l => ([...l, id]))}
        loading={isLoading}
      />
    </Container>
  );
}
