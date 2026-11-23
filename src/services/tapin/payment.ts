import type { InvoiceDocument } from '@/orders/models/Invoice';
import type { TapinPayType } from './types';

export function resolveTapinPayType(
  invoice: Pick<InvoiceDocument, 'shippingPaymentMethod'>,
  requested?: number,
): TapinPayType {
  if (invoice.shippingPaymentMethod === 'on_delivery') return 2;
  if (requested === 0 || requested === 1 || requested === 2 || requested === 3) return requested;
  return 1;
}

export function resolveTapinPrePaidPrice(payType: TapinPayType, amount: number): number {
  return payType === 0 ? Math.max(0, Math.round(amount)) : 0;
}

/** Tapin only accepts shipment insurance for online payment. */
export function resolveTapinInsurance(payType: TapinPayType, requested: boolean): boolean {
  return payType === 1 ? requested : false;
}
