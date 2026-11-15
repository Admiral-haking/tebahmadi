export type PricingLine = { id: string; priceToman: number; quantity: number };
export type PricingPromotion = { kind: "percent" | "fixed" | "shipping"; value: number; maxDiscountToman: number | null; eligibleProductIds: string[] };
export type PricingShipping = { priceToman: number; freeOverToman: number | null };
export type OrderTotals = { subtotalToman: number; discountToman: number; shippingToman: number; totalToman: number };

export function calculateOrderTotals(input: { lines: PricingLine[]; promotion?: PricingPromotion | null; shipping: PricingShipping }): OrderTotals {
  const subtotalToman = input.lines.reduce((sum, line) => sum + line.priceToman * line.quantity, 0);
  const eligible = input.promotion?.eligibleProductIds.length
    ? input.lines.reduce((sum, line) => input.promotion!.eligibleProductIds.includes(line.id) ? sum + line.priceToman * line.quantity : sum, 0)
    : subtotalToman;
  let discountToman = 0;
  if (input.promotion?.kind === "percent") discountToman = Math.floor(eligible * input.promotion.value / 100);
  else if (input.promotion?.kind === "fixed") discountToman = input.promotion.value;
  discountToman = Math.min(eligible, Math.max(0, discountToman), input.promotion?.maxDiscountToman || eligible);
  const shippingToman = input.promotion?.kind === "shipping" ? 0 : input.shipping.freeOverToman !== null && subtotalToman - discountToman >= input.shipping.freeOverToman ? 0 : Math.max(0, input.shipping.priceToman);
  return { subtotalToman, discountToman, shippingToman, totalToman: Math.max(0, subtotalToman - discountToman + shippingToman) };
}
