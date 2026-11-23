import { describe, expect, it } from 'vitest';
import { getPaymentVerificationDecision } from './paymentVerificationPolicy';

describe('payment verification policy', () => {
  it('allows only the configured and permitted Zarinpal gateway', () => {
    expect(getPaymentVerificationDecision('zarinpal')).toEqual({ allowed: true });
  });

  it('rejects disabled gateways before verification can mutate an invoice', () => {
    expect(getPaymentVerificationDecision('torob')).toEqual({
      allowed: false,
      message: 'درگاه پرداخت در حال حاضر فعال نیست.',
    });
    expect(getPaymentVerificationDecision('digipay')).toEqual({
      allowed: false,
      message: 'درگاه پرداخت در حال حاضر فعال نیست.',
    });
    expect(getPaymentVerificationDecision('snapppay')).toEqual({
      allowed: false,
      message: 'درگاه پرداخت در حال حاضر فعال نیست.',
    });
    expect(getPaymentVerificationDecision('bajetpay')).toEqual({
      allowed: false,
      message: 'درگاه پرداخت در حال حاضر فعال نیست.',
    });
    expect(getPaymentVerificationDecision('azkivam')).toEqual({
      allowed: false,
      message: 'درگاه پرداخت در حال حاضر فعال نیست.',
    });
  });
});
