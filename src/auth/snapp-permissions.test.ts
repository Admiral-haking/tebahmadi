import { describe, expect, it } from 'vitest';

import { requiredSnappPermission } from './snapp-permissions';

describe('SnappShop permission mapping', () => {
  it('does not require a write permission for reads', () => {
    expect(requiredSnappPermission('/api/snapp', 'GET')).toBeNull();
  });

  it('treats credential registration as a product operation', () => {
    expect(requiredSnappPermission('/api/snapp/auth', 'POST')).toBe('products:write');
  });

  it('keeps order mutations behind the order permission', () => {
    expect(requiredSnappPermission('/api/snapp/store-1/orders/123', 'PATCH')).toBe('orders:write');
  });

  it('fails closed for unknown SnappShop mutations', () => {
    expect(requiredSnappPermission('/api/snapp/store-1/products', 'PATCH')).toBe('products:write');
  });
});
