'use client';

import { useMemo } from "react";
import useSWR from "swr";
import { Alert, Box, Button, Container, Stack, Typography } from "@mui/material";
import Link from "next/link";

import SearchBox from "@/components/search";
import Splash from "@/components/splash";

import MetaOverridesTable from "./components/meta-overrides-table";

export type MetaOverrideListItem = {
  id: string;
  slug: string;
  title?: string;
  description?: string;
  canonical?: string;
  noindex?: boolean;
  updatedAt?: string;
};

type MetaOverridesResponse = {
  data?: Array<Record<string, any>>;
};

const fetcher = async (url: string): Promise<MetaOverridesResponse> => {
  const response = await fetch(url, { credentials: "include" });
  if (!response.ok) {
    const message = (await response.text().catch(() => "")) || response.statusText;
    throw new Error(message || "خطا در دریافت اطلاعات سئو");
  }
  return response.json();
};

function mapOverride(raw: Record<string, any>): MetaOverrideListItem {
  const seo = raw.seo ?? {};
  return {
    id: raw._id?.toString?.() ?? raw.id ?? "",
    slug: raw.slug ?? "",
    title: seo.title ?? undefined,
    description: seo.description ?? undefined,
    canonical: seo.canonical ?? undefined,
    noindex: seo.noindex ?? undefined,
    updatedAt: raw.updatedAt ? new Date(raw.updatedAt).toISOString() : undefined,
  };
}

function matchesQuery(item: MetaOverrideListItem, query: string): boolean {
  const term = query.toLowerCase();
  return (
    item.slug.toLowerCase().includes(term) ||
    (item.title ?? "").toLowerCase().includes(term) ||
    (item.description ?? "").toLowerCase().includes(term)
  );
}

export default function MetaOverridesAdminView({ q }: { q?: string }) {
  const { data, error, isLoading } = useSWR("/api/seo/meta-overrides", fetcher);

  const items = useMemo<MetaOverrideListItem[]>(() => {
    const list = data?.data ?? [];
    const normalized = list.map(mapOverride);
    const query = q?.trim();
    if (!query) {
      return normalized;
    }
    return normalized.filter((item) => matchesQuery(item, query));
  }, [data, q]);

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
          {error instanceof Error ? error.message : "خطا در دریافت اطلاعات سئو"}
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 4 }}>
        <Typography variant="h4">تنظیمات سئو - Meta Overrides</Typography>
        <Button LinkComponent={Link} href="/admin/seo/meta-overrides/save" variant="contained">
          ثبت مرجع جدید
        </Button>
      </Stack>

      <Box sx={{ mb: 3 }}>
        <SearchBox onSearchUrl="/admin/seo/meta-overrides" value={q ?? ""} alwaysShowSearch />
      </Box>

      <MetaOverridesTable items={items} />
    </Container>
  );
}
