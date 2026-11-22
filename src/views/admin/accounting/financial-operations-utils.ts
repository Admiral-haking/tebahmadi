export const today = () => new Date().toISOString().slice(0, 10);
export const money = (value: number) =>
  new Intl.NumberFormat('fa-IR').format(Math.round(value || 0));
export const percent = (value: number) =>
  `${new Intl.NumberFormat('fa-IR').format(Math.round(value))}%`;

export const accountTypeLabels: Record<string, string> = {
  asset: 'دارایی',
  liability: 'بدهی',
  equity: 'حقوق مالکانه',
  revenue: 'درآمد',
  expense: 'هزینه',
  unknown: 'نامشخص',
};
export const settlementStatusLabels: Record<string, string> = {
  imported: 'واردشده',
  reconciled: 'تطبیق‌شده',
  posted: 'سندخورده',
  unknown: 'نامشخص',
};

export function buildOperationsUrl(format: string, from?: string, to?: string) {
  const params = new URLSearchParams({ format });
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  return `/api/admin/accounting/operations?${params.toString()}`;
}
