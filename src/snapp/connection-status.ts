import { isSnappVendorActive } from './vendor-status';

export type SnappConnectionSummary = {
  registered: boolean;
  severity: 'success' | 'warning' | 'error';
  branchCount: number;
  activeBranches: number;
  message: string;
};

type SnappConnectionResponse = {
  status?: unknown;
  data?: unknown;
};

export function summarizeSnappConnection(
  response: SnappConnectionResponse,
): SnappConnectionSummary {
  if (response.status !== true) {
    return {
      registered: false,
      severity: 'error',
      branchCount: 0,
      activeBranches: 0,
      message: 'اسنپ‌شاپ اعتبارنامه را تأیید نکرد؛ توکن و کد یکتا را بررسی کنید.',
    };
  }

  const branches = Array.isArray(response.data) ? response.data : [];
  const activeBranches = branches.filter((branch) => {
    if (!branch || typeof branch !== 'object') return false;
    return isSnappVendorActive((branch as { status?: unknown }).status);
  }).length;

  if (activeBranches > 0) {
    return {
      registered: true,
      severity: 'success',
      branchCount: branches.length,
      activeBranches,
      message: `توکن ثبت شد و ${activeBranches.toLocaleString('fa-IR')} شعبهٔ فعال برای عملیات آماده است.`,
    };
  }

  return {
    registered: true,
    severity: 'warning',
    branchCount: branches.length,
    activeBranches: 0,
    message:
      branches.length > 0
        ? 'توکن ثبت شد، اما اسنپ‌شاپ هنوز شعبهٔ فعال ارائه نکرده است؛ فعال‌سازی از پنل اسنپ‌شاپ انجام می‌شود.'
        : 'توکن ثبت شد، اما اسنپ‌شاپ هیچ شعبه‌ای برنگرداند؛ وضعیت فروشگاه را در پنل اسنپ‌شاپ بررسی کنید.',
  };
}
