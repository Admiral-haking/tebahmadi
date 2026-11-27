import { describe, expect, it } from 'vitest';

import {
  canActivateNaturalProduct,
  getMissingNaturalProductFields,
} from './natural-product-readiness.mjs';

describe('natural product readiness', () => {
  it('blocks activation when the supplied product has no volume or weight', () => {
    const product = {
      title: 'روغن دانه به',
      description: 'توضیحات محصول',
      attrs: {},
      variantAttributeValues: [],
      measurementKeys: ['volumeMl', 'weightGrams'],
      publishRequested: true,
    };

    expect(getMissingNaturalProductFields(product)).toEqual(['volumeMl or weightGrams']);
    expect(canActivateNaturalProduct(product)).toBe(false);
  });

  it('allows activation only for complete data explicitly approved for publishing', () => {
    const product = {
      title: 'روغن لاغری',
      description: 'توضیحات محصول',
      attrs: { volumeMl: 60 },
      variantAttributeValues: [{ key: 'volumeMl', value: 60 }],
      measurementKeys: ['volumeMl', 'weightGrams'],
      publishRequested: true,
    };

    expect(getMissingNaturalProductFields(product)).toEqual([]);
    expect(canActivateNaturalProduct(product)).toBe(true);
  });

  it('keeps safety-review products inactive even when their measurement exists', () => {
    const product = {
      title: 'روغن رفع موی زائد',
      description: 'توضیحات محصول',
      attrs: { volumeMl: 60 },
      variantAttributeValues: [{ key: 'volumeMl', value: 60 }],
      measurementKeys: ['volumeMl', 'weightGrams'],
      requiresSafetyReview: true,
      publishRequested: true,
    };

    expect(canActivateNaturalProduct(product)).toBe(false);
  });
});
