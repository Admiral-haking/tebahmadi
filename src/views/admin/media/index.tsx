'use client';

import { useMemo } from 'react';
import useSWR from 'swr';
import { Alert, Container } from '@mui/material';

import Splash from '@/components/splash';

import MediaBrowser from './components/media-browser';
import type { MediaFilterState, MediaListItem } from './types';

const PAGE_SIZE = 24;

type MediaApiResponse = {
  items: MediaListItem[];
  filters: MediaFilterState;
  page: number;
  pages: number;
  total: number;
  pageSize: number;
};

const fetcher = async (url: string): Promise<MediaApiResponse> => {
  const response = await fetch(url, { credentials: 'include' });
  if (!response.ok) {
    const message = (await response.text().catch(() => '')) || response.statusText;
    throw new Error(message);
  }
  return response.json();
};

interface MediaAdminViewProps {
  page?: number;
  q?: string;
  scope?: string;
  kind?: string;
  owner?: string;
}

export default function MediaAdminView({ page, q, scope, kind, owner }: MediaAdminViewProps) {
  const endpoint = useMemo(() => {
    const params = new URLSearchParams();
    if (page && page > 1) {
      params.set('page', page.toString());
    }
    if (q && q.trim()) {
      params.set('q', q.trim());
    }
    if (scope && scope !== 'all') {
      params.set('scope', scope);
    }
    if (kind && kind !== 'all') {
      params.set('kind', kind);
    }
    if (owner && owner.trim()) {
      params.set('owner', owner.trim());
    }
    const query = params.toString();
    return `/api/admin/media${query ? `?${query}` : ''}`;
  }, [kind, owner, page, q, scope]);

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
        <Alert severity="error">{(error instanceof Error ? error.message : 'خطا در بارگذاری رسانه')}</Alert>
      </Container>
    );
  }

  const payload = data ?? {
    items: [],
    filters: { scope: 'all', kind: 'all', q: '', owner: '' },
    page: 1,
    pages: 1,
    total: 0,
    pageSize: PAGE_SIZE,
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <MediaBrowser
        items={payload.items}
        filters={payload.filters}
        page={payload.page}
        pages={payload.pages}
        total={payload.total}
        pageSize={payload.pageSize}
      />
    </Container>
  );
}
