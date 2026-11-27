export type ReceiptSiteInfo = {
  addresses?: Array<{ address?: string | null }> | null;
} | null | undefined;

export function getReceiptAddress(siteInfo: ReceiptSiteInfo): string {
  const address = siteInfo?.addresses?.[0]?.address?.trim();
  return address || '—';
}
