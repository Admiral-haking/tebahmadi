import { describe, expect, it } from 'vitest';
import { getBajetPayCallbackPath, normalizeBajetPayBaseUrl } from './paymentConfig';

describe('BajetPay configuration', () => {
  it('normalizes the provider base URL exactly once', () => {
    expect(normalizeBajetPayBaseUrl('https://jetpay.example/')).toBe(
      'https://jetpay.example/api/v1/jetpay',
    );
    expect(normalizeBajetPayBaseUrl('https://jetpay.example/api/v1/jetpay/')).toBe(
      'https://jetpay.example/api/v1/jetpay',
    );
  });

  it('uses a stable callback path', () => {
    expect(getBajetPayCallbackPath()).toBe('/api/payments/bajetpay/callback');
  });
});
