import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { middleware } from './middleware';

describe('disabled integration middleware boundary', () => {
  it('allows guest cart recommendations to load on the public cart page', async () => {
    const response = await middleware(new NextRequest('http://localhost/api/cart/suggestions?limit=20', { method: 'GET' }));

    expect(response.status).toBe(200);
  });

  it('allows anonymous cart recommendation events through the guarded public endpoint', async () => {
    const response = await middleware(new NextRequest('http://localhost/api/cart/suggestions/events', { method: 'POST' }));

    expect(response.status).toBe(200);
  });

  it('allows public purchase-link lookups before a guest adds the item to cart', async () => {
    const response = await middleware(new NextRequest('http://localhost/api/store/buy-link?variant=sku-1', { method: 'GET' }));

    expect(response.status).toBe(200);
  });

  it('allows guests to load active shipping methods for checkout', async () => {
    const response = await middleware(new NextRequest('http://localhost/api/transport?isActive=true', { method: 'GET' }));

    expect(response.status).toBe(200);
  });

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
