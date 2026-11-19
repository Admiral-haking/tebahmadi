'use client';

import {
  AutoAwesomeRounded,
  CreditScoreRounded,
  ErrorOutlineRounded,
  HubRounded,
  LockRounded,
  NetworkCheckRounded,
  PublicRounded,
  ReceiptRounded,
  StorageRounded,
  TaskAltRounded,
  WarningAmberRounded,
} from '@mui/icons-material';
import { Alert, Box, Chip, Divider, LinearProgress, Paper, Stack, Typography, Grid } from '@mui/material';
import type { EnvHealthSummary, EnvVariableSummary } from '../../hooks';

const CATEGORY_META: Record<
  string,
  { label: string; icon: React.ElementType; tone: 'primary' | 'secondary' | 'success' | 'warning' | 'info' }
> = {
  core: { label: 'پیکربندی عمومی', icon: PublicRounded, tone: 'primary' },
  database: { label: 'دیتابیس', icon: StorageRounded, tone: 'secondary' },
  auth: { label: 'احراز هویت', icon: LockRounded, tone: 'warning' },
  payments: { label: 'پرداخت', icon: CreditScoreRounded, tone: 'success' },
  marketplaces: { label: 'مارکت‌پلیس‌ها', icon: HubRounded, tone: 'info' },
  notifications: { label: 'پیامک و اعلان', icon: ReceiptRounded, tone: 'info' },
  ai: { label: 'هوش مصنوعی', icon: AutoAwesomeRounded, tone: 'secondary' },
  network: { label: 'شبکه و پروکسی', icon: NetworkCheckRounded, tone: 'secondary' },
};

interface EnvironmentVariablesCardProps {
  envSummary: EnvVariableSummary[];
  envHealth?: EnvHealthSummary | null;
}

export default function EnvironmentVariablesCard({ envSummary, envHealth }: EnvironmentVariablesCardProps) {
  if (!envSummary.length) {
    return null;
  }

  const grouped = envSummary.reduce<Record<string, EnvVariableSummary[]>>((acc, item) => {
    const category = item.category ?? 'core';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(item);
    return acc;
  }, {});

  const orderedEntries = Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b));
  const requiredIssues = envSummary.filter((item) => item.status === 'error').length;
  const warnings = envSummary.filter((item) => item.status === 'warning').length;
  const configured = envSummary.filter((item) => item.present && item.status === 'ok').length;
  const criticalItems = envSummary.filter((item) => item.status === 'error').slice(0, 6);
  const score = envHealth?.score ?? Math.max(0, Math.round((configured / Math.max(envSummary.length, 1)) * 100));

  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, bgcolor: "rgba(var(--mui-palette-primary-lightChannel) / 0.04)" }}>
      <Stack spacing={1.5} mb={2}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" gap={1}>
          <Box>
            <Typography variant="h6" fontWeight={600}>
              وضعیت متغیرهای محیطی و امنیت
            </Typography>
            <Typography variant="body2" color="text.secondary">
              مقادیر زیر باید داخل فایل .env مربوط به محیط جاری ({process.env.NODE_ENV}) تنظیم شوند. مقادیر سری فقط به صورت ماسک‌شده نمایش داده می‌شوند.
            </Typography>
          </Box>
          <Stack sx={{ minWidth: { md: 220 } }} spacing={0.5}>
            <Typography variant="caption" color="text.secondary">
              امتیاز سلامت تنظیمات: {score.toLocaleString('fa-IR')}٪
            </Typography>
            <LinearProgress
              variant="determinate"
              value={score}
              sx={{
                height: 9,
                borderRadius: 99,
                bgcolor: "rgba(var(--mui-palette-warning-mainChannel) / 0.13)",
              }}
            />
          </Stack>
        </Stack>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          <Chip icon={<TaskAltRounded />} color="success" label={`${configured} مورد سالم`} />
          <Chip icon={<WarningAmberRounded />} color="warning" label={`${warnings} هشدار`} />
          <Chip icon={<ErrorOutlineRounded />} color="error" label={`${requiredIssues} خطای ضروری`} />
          {envHealth?.missingRequired ? (
            <Chip color="error" variant="outlined" label={`${envHealth.missingRequired} متغیر ضروری خالی`} />
          ) : null}
        </Stack>
        {envHealth?.groupIssues?.map((issue) => (
          <Alert key={issue.group} severity={issue.status}>
            {issue.message}
          </Alert>
        ))}
        {criticalItems.length ? (
          <Alert severity="error">
            موارد فوری: {criticalItems.map((item) => item.label).join('، ')}
          </Alert>
        ) : null}
      </Stack>

      <Grid container spacing={2}>
        {orderedEntries.map(([category, items]) => {
          const meta = CATEGORY_META[category] ?? CATEGORY_META.core;
          const Icon = meta.icon;
          return (
            <Grid key={category} size={{ xs: 12, md: 6 }}>
              <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
                <Stack direction="row" spacing={1} alignItems="center" mb={1.5}>
                  <Icon color={meta.tone} fontSize="small" />
                  <Typography variant="subtitle1" fontWeight={600}>
                    {meta.label}
                  </Typography>
                </Stack>
                <Stack spacing={1.25}>
                  {items.map((env) => {
                    const status = env.status ?? (env.present ? 'ok' : 'error');
                    const statusColor = status === 'error' ? 'error' : status === 'warning' ? 'warning' : 'success';
                    return (
                    <Stack key={env.key} spacing={0.75} sx={{ borderLeft: 3, borderColor: `${statusColor}.light`, pl: 1.5 }}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="body1" fontWeight={600}>
                          {env.label}
                        </Typography>
                        <Chip
                          size="small"
                          color={statusColor}
                          label={status === 'error' ? 'نیاز به اصلاح' : status === 'warning' ? 'هشدار' : 'سالم'}
                        />
                        {env.optional ? <Chip size="small" variant="outlined" label="اختیاری" /> : null}
                      </Stack>
                      <Typography variant="body2" color="text.secondary">
                        {env.description}
                      </Typography>
                      {env.issues?.length ? (
                        <Alert severity={status === 'error' ? 'error' : 'warning'} sx={{ py: 0.25 }}>
                          {env.issues.join(' ')}
                        </Alert>
                      ) : null}
                      {env.example ? (
                        <Typography variant="caption" color="text.secondary">
                          مثال: {env.example}
                        </Typography>
                      ) : null}
                      {env.aliases?.length ? (
                        <Typography variant="caption" color="text.secondary" sx={{ direction: 'ltr' }}>
                          aliases: {env.aliases.join(', ')}
                        </Typography>
                      ) : null}
                      {env.sourceKey && env.sourceKey !== env.key ? (
                        <Typography variant="caption" color="warning.main" sx={{ direction: 'ltr' }}>
                          active source: {env.sourceKey}
                        </Typography>
                      ) : null}
                      {env.callbackUrl ? (
                        <Typography variant="caption" color="primary" sx={{ direction: 'ltr', wordBreak: 'break-all' }}>
                          callback: {env.callbackUrl}
                        </Typography>
                      ) : null}
                      {env.secret ? (
                        <Typography variant="caption" sx={{ direction: 'ltr' }}>
                          {env.maskedValue ?? '***'}
                        </Typography>
                      ) : env.value ? (
                        <Typography variant="caption" sx={{ direction: 'ltr' }}>
                          {env.value}
                        </Typography>
                      ) : null}
                    </Stack>
                  )})}
                </Stack>
                <Divider sx={{ mt: 1.5 }} />
              </Paper>
            </Grid>
          );
        })}
      </Grid>
    </Paper>
  );
}
