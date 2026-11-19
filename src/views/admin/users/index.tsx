'use client';

import { useMemo } from 'react';
import useSWR from 'swr';
import { Alert, Box, Button, Container, Stack, Typography } from '@mui/material';
import Link from 'next/link';

import UsersTable from './components/users-table';
import SearchBox from '@/components/search';
import AppPagination from '@/components/search/pagination';
import Splash from '@/components/splash';

type UsersResponse = {
  users?: Array<Record<string, any>>;
  total?: number;
  page?: number;
  pages?: number;
  limit?: number;
};

const fetcher = async (url: string): Promise<UsersResponse> => {
  const response = await fetch(url, { credentials: 'include' });
  if (!response.ok) {
    const message = (await response.text().catch(() => '')) || response.statusText;
    throw new Error(message || 'خطا در دریافت کاربران');
  }
  return response.json();
};

export default function UsersAdminView({ page, q }: { page: number; q?: string }) {
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const endpoint = useMemo(() => {
    const params = new URLSearchParams();
    params.set('page', safePage.toString());
    params.set('limit', '50');
    const query = q?.trim();
    if (query) {
      params.set('q', query);
    }
    return `/api/admin/users?${params.toString()}`;
  }, [q, safePage]);

  const { data, error, isLoading } = useSWR(endpoint, fetcher, {
    keepPreviousData: true,
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
        <Alert severity="error">{error instanceof Error ? error.message : 'خطا در دریافت کاربران'}</Alert>
      </Container>
    );
  }

  const users = data?.users ?? [];
  const pages = data?.pages ?? 1;

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Typography variant="h4">کاربران</Typography>

        <Button LinkComponent={Link} href="/admin/users/save">
          کاربر جدید
        </Button>
      </Stack>

      <Box sx={{ my: 4 }}>
        <SearchBox onSearchUrl="/admin/users" alwaysShowSearch value={q ?? ''} />
      </Box>

      <UsersTable users={users as any} page={safePage} pages={pages} />

      <Stack direction="row" justifyContent="end" sx={{ my: 4 }}>
        <AppPagination page={safePage} pages={pages} />
      </Stack>
    </Container>
  );
}
