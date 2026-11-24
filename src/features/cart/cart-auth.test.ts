import { describe, expect, it } from 'vitest';

import { requiresCartLogin } from './cart-auth';

describe('cart authentication gate', () => {
  it('requires login before a guest can add a product', () => {
    expect(requiresCartLogin('unauthenticated', false)).toBe(true);
    expect(requiresCartLogin('idle', false)).toBe(true);
    expect(requiresCartLogin('loading', false)).toBe(true);
  });

  it('allows cart mutations only with an authenticated user', () => {
    expect(requiresCartLogin('authenticated', true)).toBe(false);
    expect(requiresCartLogin('authenticated', false)).toBe(true);
  });
});
