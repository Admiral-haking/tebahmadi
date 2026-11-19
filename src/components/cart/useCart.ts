'use client';

import { useMemo } from 'react';
import { type CartLine, type CartAddress, type ShippingPaymentMethod, useCartContext } from './CartProvider';

export type { CartLine, CartAddress, ShippingPaymentMethod } from './CartProvider';

export function useCart() {
  const ctx = useCartContext();

  const addFixedLine = (line: CartLine, qty = 1) => {
    const min =
      typeof line.minimumOrderQuantity === 'number' && line.minimumOrderQuantity > 0
        ? line.minimumOrderQuantity
        : undefined;
    const rawMax =
      typeof line.maximumOrderQuantity === 'number' && line.maximumOrderQuantity > 0
        ? line.maximumOrderQuantity
        : undefined;
    const max = rawMax !== undefined && min !== undefined && rawMax < min ? min : rawMax;

    let quantity = qty > 0 ? qty : 1;
    quantity = Math.max(1, Math.floor(quantity));
    if (min !== undefined && quantity < min) {
      quantity = Math.max(Math.ceil(min), 1);
    }
    if (max !== undefined && quantity > max) {
      quantity = Math.max(Math.floor(max), 1);
    }

    ctx.addLine({
      ...line,
      priceModel: 'fixed',
      qty: quantity,
      requestedQty: undefined,
      requestedUnit: undefined,
      minimumOrderQuantity: min,
      maximumOrderQuantity: max,
    });
  };

  const addPerUnitLine = (line: CartLine, requestedQty: number, requestedUnit?: string) => {
    const min =
      typeof line.minimumOrderQuantity === 'number' && line.minimumOrderQuantity > 0
        ? line.minimumOrderQuantity
        : undefined;
    const rawMax =
      typeof line.maximumOrderQuantity === 'number' && line.maximumOrderQuantity > 0
        ? line.maximumOrderQuantity
        : undefined;
    const max = rawMax !== undefined && min !== undefined && rawMax < min ? min : rawMax;

    let qty = requestedQty > 0 ? requestedQty : 0;
    if (qty <= 0) return;
    if (min !== undefined && qty < min) {
      qty = min;
    }
    if (max !== undefined && qty > max) {
      qty = max;
    }
    ctx.addLine({
      ...line,
      priceModel: 'per_unit',
      requestedQty: Number(qty.toFixed(2)),
      requestedUnit: (requestedUnit as CartLine['requestedUnit']) ?? line.requestedUnit,
      qty: undefined,
      minimumOrderQuantity: min,
      maximumOrderQuantity: max,
    });
  };

  return useMemo(
    () => ({
      ...ctx,
      addFixedLine,
      addPerUnitLine,
    }),
    [ctx],
  );
}
