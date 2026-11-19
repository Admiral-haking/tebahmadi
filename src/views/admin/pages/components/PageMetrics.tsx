import { Box, Chip, Divider, LinearProgress, Stack, Typography } from '@mui/material';

import type { PageStatus } from '..';

interface PageMetricsProps {
  statusBuckets: Record<PageStatus, number>;
  total: number;
  latestPublishedAt: string | null;
  publishedLastWeek: number;
}

const STATUS_META: Record<
  PageStatus,
  {
    label: string;
    description: string;
    accent: 'success' | 'warning' | 'default';
    gradient: string;
  }
> = {
  published: {
    label: 'منتشر شده',
    description: 'در وب‌سایت در دسترس بازدیدکنندگان است.',
    accent: 'success',
    gradient:
      'linear-gradient(135deg, rgba(var(--mui-palette-success-mainChannel) / 0.18), rgba(var(--mui-palette-success-mainChannel) / 0.05))',
  },
  draft: {
    label: 'پیش‌نویس',
    description: 'در حال تکمیل و آماده‌سازی است.',
    accent: 'warning',
    gradient:
      'linear-gradient(135deg, rgba(var(--mui-palette-warning-mainChannel) / 0.18), rgba(var(--mui-palette-warning-mainChannel) / 0.05))',
  },
  archived: {
    label: 'آرشیوشده',
    description: 'برای استناد داخلی نگهداری می‌شود.',
    accent: 'default',
    gradient:
      'linear-gradient(135deg, rgba(var(--mui-palette-text-primaryChannel) / 0.16), rgba(var(--mui-palette-background-defaultChannel) / 0.6))',
  },
};

function formatNumber(value: number): string {
  return value.toLocaleString('fa-IR');
}

export default function PageMetrics({ statusBuckets, total, latestPublishedAt, publishedLastWeek }: PageMetricsProps) {
  const published = statusBuckets.published ?? 0;
  const draft = statusBuckets.draft ?? 0;
  const archived = statusBuckets.archived ?? 0;
  const ratioPublished = total > 0 ? Math.round((published / total) * 100) : 0;

  return (
    <Stack spacing={3}>
      <Box
        sx={{
          borderRadius: 3,
          p: 3,
          background: 'linear-gradient(135deg, rgba(var(--mui-palette-primary-mainChannel) / 0.16), rgba(var(--mui-palette-primary-mainChannel) / 0.04))',
          border: '1px solid rgba(var(--mui-palette-primary-mainChannel) / 0.16)',
        }}
      >
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={2}>
            <Stack spacing={0.75}>
              <Typography variant="subtitle2" color="text.secondary">
                وضعیت کلی انتشار
              </Typography>
              <Typography variant="h4" fontWeight={800}>
                {formatNumber(total)} صفحه
              </Typography>
            </Stack>

            <Chip
              label={`نرخ انتشار: ${formatNumber(ratioPublished)}٪`}
              color={ratioPublished > 60 ? 'success' : ratioPublished > 30 ? 'warning' : 'default'}
              variant={ratioPublished > 60 ? 'filled' : 'outlined'}
              sx={{ px: 1.5, fontWeight: 600 }}
            />
          </Stack>

          <Stack spacing={1}>
            <LinearProgress
              variant="determinate"
              value={ratioPublished}
              sx={{
                height: 8,
                borderRadius: 4,
                bgcolor: 'rgba(var(--mui-palette-primary-mainChannel) / 0.08)',
                '& .MuiLinearProgress-bar': {
                  borderRadius: 4,
                  background: 'linear-gradient(135deg, var(--mui-palette-primary-main), rgba(var(--mui-palette-primary-mainChannel) / 0.6))',
                },
              }}
            />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }}>
              <Typography variant="caption" color="text.secondary">
                {`آخرین انتشار: ${latestPublishedAt ?? '—'}`}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {publishedLastWeek > 0
                  ? `${formatNumber(publishedLastWeek)} صفحه در هفت روز گذشته منتشر شده`
                  : 'در هفته گذشته صفحه‌ای منتشر نشده است'}
              </Typography>
            </Stack>
          </Stack>
        </Stack>
      </Box>

      <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2}>
        {(Object.keys(STATUS_META) as PageStatus[]).map((status) => {
          const meta = STATUS_META[status];
          const count = statusBuckets[status] ?? 0;
          return (
            <Box
              key={status}
              sx={{
                flex: 1,
                borderRadius: 3,
                p: 2.5,
                border: '1px solid rgba(var(--mui-palette-dividerChannel) / 0.6)',
                background: meta.gradient,
                minHeight: 140,
              }}
            >
              <Stack spacing={1.5}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    {meta.label}
                  </Typography>
                  <Chip label={formatNumber(count)} color={meta.accent} variant={meta.accent === 'default' ? 'outlined' : 'filled'} size="small" />
                </Stack>
                <Typography variant="body2" color="text.secondary">
                  {meta.description}
                </Typography>
                <Divider flexItem light sx={{ borderStyle: 'dashed', borderColor: 'rgba(var(--mui-palette-dividerChannel) / 0.5)' }} />
                <Typography variant="caption" color="text.secondary">
                  سهم: {total > 0 ? `${formatNumber(Math.round((count / total) * 100))}٪` : '—'}
                </Typography>
              </Stack>
            </Box>
          );
        })}
      </Stack>

      <Box
        sx={{
          borderRadius: 3,
          p: 2.5,
          border: '1px solid rgba(var(--mui-palette-dividerChannel) / 0.4)',
          bgcolor: 'rgba(var(--mui-palette-background-paperChannel) / 0.9)',
        }}
      >
        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
          وضعیت فعلی
        </Typography>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          <Stack spacing={0.5} flex={1}>
            <Typography variant="body1" fontWeight={600}>
              {formatNumber(published)} صفحه منتشر شده
            </Typography>
            <Typography variant="caption" color="text.secondary">
              برای اطمینان از به‌روزرسانی محتوا، روند انتشار را حفظ کنید.
            </Typography>
          </Stack>
          <Stack spacing={0.5} flex={1}>
            <Typography variant="body1" fontWeight={600}>
              {formatNumber(draft)} پیش‌نویس فعال
            </Typography>
            <Typography variant="caption" color="text.secondary">
              پیشنهاد می‌شود برنامه‌ریزی انتشار برای پیش‌نویس‌ها انجام شود.
            </Typography>
          </Stack>
          <Stack spacing={0.5} flex={1}>
            <Typography variant="body1" fontWeight={600}>
              {formatNumber(archived)} صفحه در آرشیو
            </Typography>
            <Typography variant="caption" color="text.secondary">
              برای جلوگیری از ازدحام، آرشیو را به صورت دوره‌ای بازبینی کنید.
            </Typography>
          </Stack>
        </Stack>
      </Box>
    </Stack>
  );
}
