import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { middleware } from './middleware';

describe('disabled integration middleware boundary', () => {
  it.each([
    ['/api/digikala/webhook', 'digikala'],
    ['/api/basalaam/webhook', 'basalaam'],
    ['/api/marketplace/orders', 'marketplaceIntegrations'],
    ['/api/marketplace/tracking', 'marketplaceIntegrations'],
    ['/api/marketplace/products', 'marketplaceIntegrations'],
    ['/api/admin/orders/marketplace-presence', 'marketplaceIntegrations'],
    ['/api/payments/torob/callback', 'torob'],
    ['/api/payments/digipay/callback', 'digipay'],
    ['/api/payments/snapppay/callback', 'snapppay'],
    ['/api/payments/bajetpay/callback', 'bajetpay'],
  ] as const)('returns a feature-disabled response for %s', async (pathname, feature) => {
    const response = await middleware(new NextRequest(`http://localhost${pathname}`, { method: 'POST' }));

    expect(response.status).toBe(404);
    const expected = ['torob', 'digipay', 'snapppay', 'bajetpay'].includes(feature)
      ? { error: 'feature_disabled', feature: 'paymentGateway', gateway: feature }
      : { error: 'feature_disabled', feature };
    expect(await response.json()).toMatchObject(expected);
  });
});
