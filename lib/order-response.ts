export function orderResponseTotals(order: { subtotal_toman: unknown; discount_toman?: unknown; shipping_toman?: unknown }) {
  const totalToman = Number(order.subtotal_toman) || 0;
  const shippingToman = Number(order.shipping_toman) || 0;
  const discountToman = Number(order.discount_toman) || 0;
  return {
    subtotalToman: Math.max(0, totalToman - shippingToman),
    shippingToman,
    totalToman,
    discountToman,
  };
}
