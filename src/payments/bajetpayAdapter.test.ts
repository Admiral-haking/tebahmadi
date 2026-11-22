import { describe, expect, it } from 'vitest';
import { normalizeBajetPayCallback } from './bajetpayAdapter';

describe('BajetPay callback normalization', () => {
  it('accepts common query and form field aliases without trusting success', () => {
    expect(
      normalizeBajetPayCallback({
        invoiceId: 'invoice-1',
        tx: 'tx-1',
        body: { referenceId: 'ref-22', status: 'success', amount: '1250000' },
      }),
    ).toEqual({
      invoiceId: 'invoice-1',
      transactionId: 'tx-1',
      referenceId: 'ref-22',
      state: 'success',
      amountRial: 1250000,
    });
  });

  it('rejects a callback that has no transaction or invoice identity', () => {
    expect(normalizeBajetPayCallback({ body: { referenceId: 'ref-22' } })).toBeNull();
  });
});
