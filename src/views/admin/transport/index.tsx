'use client';

import { useMemo } from "react";
import useSWR from "swr";
import { Alert, Box, Button, Container, Stack, Typography } from "@mui/material";
import Link from "next/link";

import SearchBox from "@/components/search";
import Splash from "@/components/splash";

import TransportTable from "./components/transport-table";

export type TransportListItem = {
  id: string;
  name: string;
  isActive: boolean;
  pricingRows: Array<{
    destRegion?: string;
    basePrice: number;
    baseWeightLimit: number;
    baseWeightUnit: 'g' | 'kg';
    maxWeight?: number;
    label?: string;
  }>;
  updatedAt?: string;
};

type TransportResponse = {
  data?: Array<Record<string, any>>;
};

const fetcher = async (url: string): Promise<TransportResponse> => {
  const response = await fetch(url, { credentials: "include" });
  if (!response.ok) {
    const message = (await response.text().catch(() => "")) || response.statusText;
    throw new Error(message || "خطا در دریافت اطلاعات حمل و نقل");
  }
  return response.json();
};

function mapTransport(raw: Record<string, any>): TransportListItem {
  return {
    id: raw._id?.toString?.() ?? raw.id ?? "",
    name: raw.name ?? "",
    isActive: raw.isActive ?? true,
    pricingRows: Array.isArray(raw.pricingRows)
      ? raw.pricingRows.map((row: Record<string, any>) => ({
          destRegion: row?.destRegion ?? undefined,
          basePrice: row?.basePrice ?? 0,
          baseWeightLimit: row?.baseWeightLimit ?? 0,
          baseWeightUnit: row?.baseWeightUnit ?? "g",
          maxWeight: row?.maxWeight ?? undefined,
          label: row?.label ?? undefined,
        }))
      : [],
    updatedAt: raw.updatedAt ? new Date(raw.updatedAt).toISOString() : undefined,
  };
}

export default function TransportAdminView({ q }: { q?: string }) {
  const { data, error, isLoading } = useSWR("/api/transport", fetcher);

  const items = useMemo<TransportListItem[]>(() => {
    const list = data?.data ?? [];
    const normalized = list.map(mapTransport);
    const query = q?.trim();
    if (!query) {
      return normalized;
    }
    const term = query.toLowerCase();
    return normalized.filter((transport) => transport.name.toLowerCase().includes(term));
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
          {error instanceof Error ? error.message : "خطا در دریافت اطلاعات حمل و نقل"}
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 4 }}>
        <Typography variant="h4">حمل و نقل</Typography>
        <Button LinkComponent={Link} href="/admin/transport/save" variant="contained">
          تعریف روش جدید
        </Button>
      </Stack>

      <Box sx={{ mb: 3 }}>
        <SearchBox onSearchUrl="/admin/transport" value={q ?? ""} alwaysShowSearch />
      </Box>

      <TransportTable items={items} />
    </Container>
  );
}
