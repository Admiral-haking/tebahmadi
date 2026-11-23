import { afterEach, describe, expect, it, vi } from 'vitest';

import { getTapinConfig } from './client';

describe('Tapin environment compatibility', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('accepts the existing TAPIN_TOKEN and TAPIN_BASE_URL names', () => {
    vi.stubEnv('TAPIN_WEBSERVICE_TOKEN', '');
    vi.stubEnv('TAPIN_TOKEN', 'legacy-token');
    vi.stubEnv('TAPIN_SHOP_ID', 'shop-id');
    vi.stubEnv('TAPIN_API_BASE_URL', '');
    vi.stubEnv('TAPIN_BASE_URL', 'https://legacy-tapin.example/api');

    expect(getTapinConfig()).toEqual({
      token: 'legacy-token',
      shopId: 'shop-id',
      baseUrl: 'https://legacy-tapin.example/api',
    });
  });

  it('prefers the explicit operational names when both aliases are present', () => {
    vi.stubEnv('TAPIN_WEBSERVICE_TOKEN', 'webservice-token');
    vi.stubEnv('TAPIN_TOKEN', 'legacy-token');
    vi.stubEnv('TAPIN_SHOP_ID', 'shop-id');
    vi.stubEnv('TAPIN_API_BASE_URL', 'https://explicit-tapin.example/api');
    vi.stubEnv('TAPIN_BASE_URL', 'https://legacy-tapin.example/api');

    expect(getTapinConfig()).toEqual({
      token: 'webservice-token',
      shopId: 'shop-id',
      baseUrl: 'https://explicit-tapin.example/api',
    });
  });
});
