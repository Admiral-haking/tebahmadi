'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Alert, Button, Card, CardContent, Container, Divider, LinearProgress, Stack, Typography } from '@mui/material';
import Grid from '@mui/material/Grid';

import PageMetrics from './components/PageMetrics';
import PageStatusFilters from './components/PageStatusFilters';
import PageTable from './components/PageTable';
import SearchBox from '@/components/search';

export type PageStatus = 'draft' | 'published' | 'archived';

export interface PageListItem {
  id: string;
  title: string;
  slug: string;
  status: PageStatus;
  publishedAt: string | null;
  updatedAt: string | null;
  publishedAtLabel: string;
  updatedAtLabel: string;
  excerpt: string;
  seoTitle?: string;
}

interface PagesResponseMeta {
  total: number;
  limit: number;
  skip: number;
  statusCounts: Record<PageStatus, number>;
  latestPublishedAt: string | null;
  publishedLastWeek: number;
}

interface PagesResponse {
  data: PageListItem[];
  meta: PagesResponseMeta;
}

const PAGE_SIZE = 15;

function parsePage(value: string | null): number {
  if (!value) return 1;
  const parsed = Number(value);
  if (Number.isNaN(parsed) || parsed < 1) return 1;
  return Math.floor(parsed);
}

function parseStatuses(params: URLSearchParams): PageStatus[] {
  const raw = params.getAll('status');
  if (raw.length === 0) return [];
  const allowed = new Set<PageStatus>(['draft', 'published', 'archived']);
  const normalized = raw
    .map((item) => item.trim().toLowerCase())
    .filter((item): item is PageStatus => allowed.has(item as PageStatus));
  return Array.from(new Set(normalized));
}

function parseQuery(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

const DEFAULT_META: PagesResponseMeta = {
  total: 0,
  limit: PAGE_SIZE,
  skip: 0,
  statusCounts: { draft: 0, published: 0, archived: 0 },
  latestPublishedAt: null,
  publishedLastWeek: 0,
};

export default function PagesAdminView() {
  const searchParams = useSearchParams();
  const [pages, setPages] = useState<PageListItem[]>([]);
  const [meta, setMeta] = useState<PagesResponseMeta>(DEFAULT_META);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const page = useMemo(() => parsePage(searchParams?.get('page') || "1"), [searchParams]);
  const statuses = useMemo(() => searchParams ? parseStatuses(searchParams) : [], [searchParams]);
  const query = useMemo(() => parseQuery(searchParams?.get('q') || ""), [searchParams]);

  const fetchPages = useCallback(async (signal: AbortSignal) => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set('limit', String(PAGE_SIZE));
      params.set('skip', String((page - 1) * PAGE_SIZE));
      params.set('metrics', '1');
      if (query) {
        params.set('q', query);
      }
      statuses.forEach((status) => params.append('status', status));

      const response = await fetch(`/api/pages?${params.toString()}`, {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
        signal,
      });

      if (!response.ok) {
        const message = (await response.text().catch(() => '')) || response.statusText;
        throw new Error(message || 'دریافت لیست صفحات با خطا مواجه شد');
      }

      const json = (await response.json()) as PagesResponse;
      setPages(json.data ?? []);
      setMeta({
        total: json.meta?.total ?? 0,
        limit: json.meta?.limit ?? PAGE_SIZE,
        skip: json.meta?.skip ?? 0,
        statusCounts: json.meta?.statusCounts ?? DEFAULT_META.statusCounts,
        latestPublishedAt: json.meta?.latestPublishedAt ?? null,
        publishedLastWeek: json.meta?.publishedLastWeek ?? 0,
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return;
      }
      const message = err instanceof Error ? err.message : 'دریافت لیست صفحات با خطا مواجه شد';
      setError(message);
      setPages([]);
      setMeta(DEFAULT_META);
    } finally {
      setLoading(false);
    }
  }, [page, query, statuses]);

  useEffect(() => {
    const controller = new AbortController();
    fetchPages(controller.signal);
    return () => controller.abort();
  }, [fetchPages, reloadToken]);

  const currentPage = Math.max(1, page);
  const totalPages = meta.limit > 0 ? Math.max(1, Math.ceil(meta.total / meta.limit)) : 1;

  const handleRefresh = useCallback(() => {
    setReloadToken((token) => token + 1);
  }, []);

  return (
    <Container maxWidth="xl" sx={{ py: 6 }}>
      <Stack spacing={4}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          alignItems={{ xs: 'flex-start', md: 'center' }}
          justifyContent="space-between"
          spacing={2}
        >
          <Stack spacing={1}>
            <Typography variant="h4" sx={{ fontWeight: 800 }}>
              مدیریت صفحات
            </Typography>
            <Typography variant="body2" color="text.secondary">
              صفحات ثابت سایت را مدیریت، انتشار و بهینه‌سازی کنید. در مجموع{' '}
              {meta.total.toLocaleString('fa-IR')} نتیجه مطابق فیلترهای فعلی یافت شد.
            </Typography>
          </Stack>
          <Button
            LinkComponent={Link}
            href="/admin/pages/save"
            variant="contained"
            size="large"
            sx={{ borderRadius: 3, px: 3.5, py: 1.25 }}
          >
            صفحه جدید
          </Button>
        </Stack>

        {error && <Alert severity="error">{error}</Alert>}

        {loading && (
          <Card variant="outlined" sx={{ borderRadius: 4 }}>
            <LinearProgress />
          </Card>
        )}

        <Card variant="outlined" sx={{ borderRadius: 4, overflow: 'hidden' }}>
          <CardContent>
            <Grid container spacing={3}>
              <Grid size={{ xs: 12, md: 7, lg: 8 }}>
                <PageMetrics
                  statusBuckets={meta.statusCounts}
                  total={meta.total}
                  latestPublishedAt={meta.latestPublishedAt}
                  publishedLastWeek={meta.publishedLastWeek}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 5, lg: 4 }}>
                <Card variant="outlined" sx={{ height: '100%', borderRadius: 3 }}>
                  <CardContent>
                    <Stack spacing={2}>
                      <Typography variant="subtitle1" fontWeight={700}>
                        جستجوی سریع
                      </Typography>
                      <SearchBox
                        onSearchUrl="/admin/pages"
                        initialQuery={query ?? undefined}
                        preserveQueryParams
                        placeholder="جستجو بر اساس عنوان، اسلاگ یا توضیحات سئو"
                      />
                      <Divider />
                      <PageStatusFilters currentStatuses={statuses} q={query ?? undefined} counts={meta.statusCounts} />
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        <PageTable
          pages={pages}
          loading={loading}
          currentPage={currentPage}
          totalPages={totalPages}
          currentStatuses={statuses}
          query={query ?? undefined}
          totalResults={meta.total}
          onRefresh={handleRefresh}
        />
      </Stack>
    </Container>
  );
}
