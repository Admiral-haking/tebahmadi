import { describe, expect, it } from 'vitest';
import { BRAND, DEFAULT_SITE_INFO } from './brand';

describe('Tab Ahmadi brand defaults', () => {
  it('provides a complete Persian storefront identity', () => {
    expect(BRAND.name).toBe('طب احمدی');
    expect(BRAND.url).toBe('https://tebahmadi.ir');
    expect(BRAND.description).toContain('محصولات طبیعی');
    expect(DEFAULT_SITE_INFO.appName).toBe(BRAND.name);
    expect(DEFAULT_SITE_INFO.phones).toEqual([]);
    expect(DEFAULT_SITE_INFO.support?.ticketEnabled).toBe(true);
  });
});
