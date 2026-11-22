import type { AccountingChannel } from './revenueService';

/** The accounting ledger's canonical display/storage unit is تومان. */
export const ACCOUNTING_CURRENCY = 'toman' as const;
export const RIALS_PER_TOMAN = 10;

/**
 * Marketplace order feeds persist their final line amounts in ریال, while site
 * invoices use تومان. Normalize only at the accounting boundary so legacy
 * source records remain faithful to their provider payloads.
 */
export function accountingAmountInToman(channel: AccountingChannel, amount: unknown): number {
  const numeric = Number(amount);
  if (!Number.isFinite(numeric)) return 0;
  return channel === 'digikala' || channel === 'basalaam' || channel === 'snapp'
    ? Math.round(numeric / RIALS_PER_TOMAN)
    : Math.round(numeric);
}

export function marketplaceAccountingAmountExpression(
  channel: AccountingChannel,
  field = '$amount',
) {
  return channel === 'digikala' || channel === 'basalaam' || channel === 'snapp'
    ? { $divide: [{ $ifNull: [field, 0] }, RIALS_PER_TOMAN] }
    : { $ifNull: [field, 0] };
}
