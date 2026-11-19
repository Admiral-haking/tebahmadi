'use client';

import { useMemo } from "react";
import useSWR from "swr";
import { Alert, Box, Button, Container, Stack, Typography } from "@mui/material";
import Link from "next/link";

import SearchBox from "@/components/search";
import Splash from "@/components/splash";

import OffersTable from "./components/offers-table";

export type OfferListItem = {
  id: string;
  code: string;
  type: string;
  amount?: number;
  startsAt?: string;
  endsAt?: string;
  usageLimitTotal?: number;
  usageLimitPerUser?: number;
  isActive: boolean;
  timesRedeemed: number;
  updatedAt?: string;
};

type OffersResponse = {
  data?: Array<Record<string, any>>;
};

const fetcher = async (url: string): Promise<OffersResponse> => {
  const response = await fetch(url, { credentials: "include" });
  if (!response.ok) {
    const message = (await response.text().catch(() => "")) || response.statusText;
    throw new Error(message || "خطا در دریافت اطلاعات کوپن‌ها");
  }
  return response.json();
};

function mapOffer(offer: Record<string, any>): OfferListItem {
  return {
    id: offer._id?.toString?.() ?? offer.id ?? "",
    code: offer.code ?? "",
    type: offer.type ?? "",
    amount: offer.amount ?? undefined,
    startsAt: offer.startsAt ? new Date(offer.startsAt).toISOString() : undefined,
    endsAt: offer.endsAt ? new Date(offer.endsAt).toISOString() : undefined,
    usageLimitTotal: offer.usageLimitTotal ?? undefined,
    usageLimitPerUser: offer.usageLimitPerUser ?? undefined,
    isActive: offer.isActive ?? true,
    timesRedeemed: offer.timesRedeemed ?? 0,
    updatedAt: offer.updatedAt ? new Date(offer.updatedAt).toISOString() : undefined,
  };
}

export default function OffersAdminView({ q }: { q?: string }) {
  const { data, error, isLoading } = useSWR("/api/offers", fetcher);

  const items = useMemo<OfferListItem[]>(() => {
    const list = data?.data ?? [];
    const normalized = list.map(mapOffer);
    const query = q?.trim();
    if (!query) {
      return normalized;
    }
    const term = query.toLowerCase();
    return normalized.filter((offer) => offer.code.toLowerCase().includes(term));
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
          {error instanceof Error ? error.message : "خطا در دریافت اطلاعات کوپن‌ها"}
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 4 }}>
        <Typography variant="h4">کوپن‌ها و تخفیف‌ها</Typography>
        <Button LinkComponent={Link} href="/admin/offers/save" variant="contained">
          کوپن جدید
        </Button>
      </Stack>

      <Box sx={{ mb: 3 }}>
        <SearchBox onSearchUrl="/admin/offers" value={q ?? ""} alwaysShowSearch />
      </Box>

      <OffersTable items={items} />
    </Container>
  );
}
