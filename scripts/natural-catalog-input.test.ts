import { describe, expect, it } from 'vitest';

import { naturalCatalogInput } from './natural-catalog-input.mjs';
import { getMissingNaturalProductFields } from './natural-product-readiness.mjs';

describe('supplier natural catalog input', () => {
  it('contains unique product slugs and SKUs for all supplied products', () => {
    expect(naturalCatalogInput).toHaveLength(12);
    expect(new Set(naturalCatalogInput.map((item) => item.slug)).size).toBe(naturalCatalogInput.length);
    expect(new Set(naturalCatalogInput.map((item) => item.sku)).size).toBe(naturalCatalogInput.length);
  });

  it('recognizes the two supplied measurements and blocks missing ones', () => {
    const slimmingOil = naturalCatalogInput.find((item) => item.slug === 'slimming-oil');
    const deodorant = naturalCatalogInput.find((item) => item.slug === 'tab-ahmadi-deodorant-powder');
    const quinceSeedOil = naturalCatalogInput.find((item) => item.slug === 'quince-seed-oil');

    expect(getMissingNaturalProductFields(slimmingOil)).toEqual([]);
    expect(getMissingNaturalProductFields(deodorant)).toEqual([]);
    expect(getMissingNaturalProductFields(quinceSeedOil)).toEqual(['volumeMl or weightGrams']);
  });

  it('keeps safety-sensitive and incomplete input out of the active catalog', () => {
    const unwantedHairOil = naturalCatalogInput.find((item) => item.slug === 'unwanted-hair-oil') as
      | { requiresSafetyReview?: boolean }
      | undefined;
    const delayCapsules = naturalCatalogInput.find((item) => item.slug === 'men-delay-herbal-capsules');

    expect(unwantedHairOil?.requiresSafetyReview).toBe(true);
    expect(delayCapsules?.measurementKeys).toEqual(['count', 'weightGrams', 'volumeMl']);
    expect(getMissingNaturalProductFields(delayCapsules)).toEqual(['count or weightGrams or volumeMl']);
  });
});
