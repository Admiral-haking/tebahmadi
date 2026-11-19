'use client';

import { JSX, useMemo } from 'react';
import useSWR from 'swr';
import { useSearchParams } from 'next/navigation';
import { Alert, Box, Button, CircularProgress, Container, Stack, Typography } from '@mui/material';
import Link from 'next/link';

import SearchBox from '@/components/search';

import ProductTypesTable from './components/product-types-table';

export type ProductTypeListItem = {
  _id: string;
  name: string;
  version?: number;
  attributes: Array<{ key: string; label: string; kind: string }>;
  createdAt?: string;
  updatedAt?: string;
};

type ProductTypesResponse = {
  productTypes?: Array<Record<string, unknown>>;
};

async function fetcher(url: string): Promise<ProductTypesResponse> {
  const response = await fetch(url, { credentials: 'include' });
  if (!response.ok) {
    const message = (await response.text().catch(() => '')) || response.statusText;
    throw new Error(message || 'Failed to load product types');
  }
  return (await response.json()) as ProductTypesResponse;
}

function normalizeListItem(input: Record<string, unknown>): ProductTypeListItem | null {
  const id = typeof input.id === 'string' ? input.id : typeof input._id === 'string' ? input._id : '';
  const name = typeof input.name === 'string' ? input.name : '';
  if (!id || !name) {
    return null;
  }

  const attributes = Array.isArray(input.attributes)
    ? (input.attributes as unknown[])
      .map((attr) => {
        if (typeof attr !== 'object' || attr === null) {
          return null;
        }
        const record = attr as Record<string, unknown>;
        const key = typeof record.key === 'string' ? record.key : '';
        if (!key) {
          return null;
        }
        const label = typeof record.label === 'string' ? record.label : '';
        const kind = typeof record.kind === 'string' ? record.kind : '';
        return { key, label, kind };
      })
      .filter((attr): attr is { key: string; label: string; kind: string } => attr !== null)
    : [];

  return {
    _id: id,
    name,
    version: typeof input.version === 'number' ? input.version : undefined,
    attributes,
    createdAt: typeof input.createdAt === 'string' ? input.createdAt : undefined,
    updatedAt: typeof input.updatedAt === 'string' ? input.updatedAt : undefined,
  } satisfies ProductTypeListItem;
}

export default function ProductTypesAdminView(): JSX.Element {
  const searchParams = useSearchParams();
  const q = (searchParams?.get('q') ?? '').trim();

  const apiUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (q.length > 0) {
      params.set('q', q);
    }
    const queryString = params.toString();
    return queryString ? `/api/catalog/product-types?${queryString}` : '/api/catalog/product-types';
  }, [q]);

  const { data, error, isLoading, mutate } = useSWR<ProductTypesResponse>(apiUrl, fetcher, {
    revalidateOnFocus: false,
    keepPreviousData: true,
  });

  const productTypes = useMemo(() => {
    if (!data?.productTypes) {
      return [] as ProductTypeListItem[];
    }
    return data.productTypes
      .map((item) => normalizeListItem(item))
      .filter((item): item is ProductTypeListItem => item !== null);
  }, [data]);

  if (isLoading && !data) {
    return (
      <Box sx={{ py: 6, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ py: 4 }}>
        <Alert severity="error">{error.message}</Alert>
      </Box>
    );
  }

  return (
    <Container maxWidth="lg">
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 4 }}>
        <Typography variant="h4">انواع محصول</Typography>
        <Button LinkComponent={Link} href="/admin/catalog/product-types/save">
          نوع محصول جدید
        </Button>
      </Stack>

      <Box sx={{ mb: 4 }}>
        <SearchBox onSearchUrl="/admin/catalog/product-types" alwaysShowSearch initialQuery={q} />
      </Box>

      <ProductTypesTable productTypes={productTypes} onRefresh={() => { mutate() }} />
    </Container>
  );
}
