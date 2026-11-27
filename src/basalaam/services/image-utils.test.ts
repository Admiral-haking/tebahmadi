import { describe, expect, it } from 'vitest';

import { getBasalaamProductImageUrl } from './image-utils';

describe('getBasalaamProductImageUrl', () => {
  it('uses a placeholder when a marketplace product has no photos', () => {
    expect(getBasalaamProductImageUrl([])).toBe('/product-placeholder.svg');
  });

  it('uses the first non-empty original image URL', () => {
    expect(getBasalaamProductImageUrl([{ original: '' }, { original: 'https://example.com/product.jpg' }])).toBe(
      'https://example.com/product.jpg',
    );
  });
});
