function hasValue(value) {
  if (typeof value === 'number') return Number.isFinite(value) && value > 0;
  if (typeof value === 'string') return value.trim().length > 0;
  return value !== null && value !== undefined;
}

function readAttribute(attributes, key) {
  if (!Array.isArray(attributes)) return undefined;
  return attributes.find((attribute) => attribute?.key === key)?.value;
}

/**
 * Returns the required data groups that are still absent from the supplier
 * input. Each measurement group is an OR group: volume OR weight is enough
 * for products whose packaging may be expressed in either unit.
 */
export function getMissingNaturalProductFields(product) {
  const missing = [];
  const attrs = product?.attrs && typeof product.attrs === 'object' ? product.attrs : {};
  const variantAttributes = product?.variantAttributeValues;

  if (!hasValue(product?.title)) missing.push('title');
  if (!hasValue(product?.description)) missing.push('description');

  const measurementKeys = Array.isArray(product?.measurementKeys) ? product.measurementKeys : [];
  if (measurementKeys.length > 0) {
    const hasMeasurement = measurementKeys.some((key) =>
      hasValue(attrs[key]) || hasValue(readAttribute(variantAttributes, key)),
    );
    if (!hasMeasurement) missing.push(measurementKeys.join(' or '));
  }

  return missing;
}

export function canActivateNaturalProduct(product) {
  return product?.publishRequested === true
    && product?.requiresSafetyReview !== true
    && getMissingNaturalProductFields(product).length === 0;
}
