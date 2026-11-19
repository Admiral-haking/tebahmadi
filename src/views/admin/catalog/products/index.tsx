"use client";

import { useMemo, useCallback } from "react";
import useSWR from "swr";
import { useSearchParams } from "next/navigation";
import { Alert, Box, Button, CircularProgress, Container, Stack, Typography } from "@mui/material";
import Link from "next/link";

import type { ProductStatus } from "@/catalog/models/Product";
import AppPagination from "@/components/search/pagination";

import ProductsTable from "./components/products-table";
import ProductsFilterBar from "./components/products-filter-bar";

export type ProductListItem = {
  id: string;
  title: string;
  slug: string;
  status: ProductStatus;
  productTypeId: string;
  productTypeName: string;
  variantCount: number;
  activeInStockVariantCount: number;
  inactiveOrOutOfStockVariantCount: number;
  minPrice?: number;
  maxPrice?: number;
  inventoryTotal?: number;
  createdAt?: string;
  updatedAt?: string;
};

const PAGE_SIZE = 20;

type ProductsApiResponse = {
  products?: Array<{
    id?: string;
    title?: string;
    slug?: string;
    status?: string;
    productTypeId?: string;
    productTypeName?: string;
    variantCount?: number;
    activeInStockVariantCount?: number;
    inactiveOrOutOfStockVariantCount?: number;
    minPrice?: number;
    maxPrice?: number;
    inventoryTotal?: number;
    createdAt?: string;
    updatedAt?: string;
  }>;
  total?: number;
};

async function fetcher(url: string): Promise<{ products: ProductListItem[]; total: number }> {
  const response = await fetch(url, { credentials: "include" });
  if (!response.ok) {
    const message = (await response.text().catch(() => "")) || response.statusText;
    throw new Error(message || "Failed to load products");
  }

  const json = (await response.json()) as ProductsApiResponse;
  const total = Number(json.total ?? 0);

  const products = Array.isArray(json.products)
    ? json.products
      .map((product) => {
        const id = product.id ?? "";
        if (!id) {
          return null;
        }

        const status = product.status;
        const normalizedStatus: ProductStatus = status === "active" || status === "archived" ? status : "draft";

        return {
          id,
          title: product.title && product.title.length > 0 ? product.title : "بدون عنوان",
          slug: product.slug ?? "",
          status: normalizedStatus,
          productTypeId: product.productTypeId ?? "",
          productTypeName: product.productTypeName ?? "-",
          variantCount: Number.isFinite(product.variantCount) ? Number(product.variantCount) : 0,
          activeInStockVariantCount: Number.isFinite(product.activeInStockVariantCount) ? Number(product.activeInStockVariantCount) : 0,
          inactiveOrOutOfStockVariantCount: Number.isFinite(product.inactiveOrOutOfStockVariantCount) ? Number(product.inactiveOrOutOfStockVariantCount) : 0,
          minPrice: product.minPrice,
          maxPrice: product.maxPrice,
          inventoryTotal: product.inventoryTotal,
          createdAt: product.createdAt,
          updatedAt: product.updatedAt,
        } satisfies ProductListItem;
      })
      .filter((item) => item !== null)
    : [];

  return { products, total: Number.isFinite(total) && total >= 0 ? total : 0 };
}

function parsePageParam(value: string | null): number {
  if (!value) return 1;
  const page = Number(value);
  if (!Number.isFinite(page) || page <= 0) return 1;
  return Math.floor(page);
}

function parseStatusParams(values: string[]): ProductStatus[] {
  const validStatuses: ProductStatus[] = [];
  values.forEach((value) => {
    if (value === "draft" || value === "active" || value === "archived") {
      validStatuses.push(value);
    }
  });
  return validStatuses;
}

export default function ProductsAdminView() {
  const searchParams = useSearchParams();

  const page = parsePageParam(searchParams?.get("page") || "1");
  const q = searchParams?.get("q") ?? "";
  const status = parseStatusParams(searchParams?.getAll("status") || []);
  const productTypeId = searchParams?.get("productTypeId") ?? "";

  const apiUrl = useMemo(() => {
    const params = new URLSearchParams();
    params.set("limit", PAGE_SIZE.toString());
    params.set("skip", Math.max(0, (page - 1) * PAGE_SIZE).toString());
    if (q.trim().length > 0) {
      params.set("q", q.trim());
    }
    if (productTypeId) {
      params.set("productTypeId", productTypeId);
    }
    status.forEach((value) => params.append("status", value));
    return `/api/catalog/products?${params.toString()}`;
  }, [page, q, status, productTypeId]);

  const { data, error, isLoading, mutate } = useSWR(apiUrl, fetcher, {
    revalidateOnFocus: false,
    keepPreviousData: true,
  });

  const products = data?.products ?? [];
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const handleRefresh = useCallback(async () => {
    await mutate();
  }, [mutate]);

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2} sx={{ mb: 3 }}>
        <Typography variant="h4">مدیریت محصولات</Typography>
        <Button LinkComponent={Link} href="/admin/catalog/products/save" variant="contained">
          محصول جدید
        </Button>
      </Stack>

      <ProductsFilterBar q={q} status={status} productTypeId={productTypeId} />

      {error && <Alert severity="error">{error.message}</Alert>}

      {isLoading && products.length === 0 ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
          <CircularProgress />
        </Box>
      ) : (
        <ProductsTable products={products} page={page} pageSize={PAGE_SIZE} onRefresh={handleRefresh} />
      )}

      <Stack direction="row" justifyContent="flex-end" sx={{ mt: 4 }}>
        <AppPagination page={page} pages={pages} />
      </Stack>
    </Container>
  );
}
