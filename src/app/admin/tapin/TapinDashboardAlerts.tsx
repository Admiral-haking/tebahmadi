import { Alert } from '@mui/material';
import { memo } from 'react';

type SyncHealth = {
  enabled: boolean;
  lastResult: { error?: string; at: string; updated: number } | null;
};

export const TapinDashboardAlerts = memo(function TapinDashboardAlerts({
  error,
  warnings,
  syncHealth,
}: {
  error: string;
  warnings?: string[];
  syncHealth?: SyncHealth;
}) {
  return (
    <>
      {error ? <Alert severity="error">{error}</Alert> : null}
      {warnings?.length ? (
        <Alert severity="warning">
          برخی بخش‌های جانبی موقتاً پاسخ ندادند: {warnings.join('، ')}
        </Alert>
      ) : null}
      {syncHealth ? (
        <Alert
          severity={
            syncHealth.lastResult?.error ? 'error' : syncHealth.enabled ? 'success' : 'warning'
          }
        >
          همگام‌سازی خودکار: {syncHealth.enabled ? 'فعال' : 'غیرفعال'}
          {syncHealth.lastResult
            ? ` — آخرین اجرا: ${syncHealth.lastResult.at}، ${syncHealth.lastResult.updated} تغییر`
            : ''}
          {syncHealth.lastResult?.error ? ` — ${syncHealth.lastResult.error}` : ''}
        </Alert>
      ) : null}
    </>
  );
});
