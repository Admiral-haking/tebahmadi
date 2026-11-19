type SnappPayInvoiceLine = {
  title: string;
  qty?: number | null;
  requestedQty?: number | null;
  lineTotal?: number | null;
  productId?: unknown;
  category?: string | null;
};

// SnappPay requires a Persian category per item; used when a line has no
// resolved product category.
const DEFAULT_CATEGORY_FA = 'عمومی';

type SnappPayInvoiceLike = {
  subtotal?: number;
  shippingTotal?: number;
  discountTotal?: number;
  grandTotal?: number;
  lines?: SnappPayInvoiceLine[];
};

export type SnappPayGatewayCartItem = {
  id: string | number;
  name: string;
  count: number;
  amount: number;
  category: string;
  commissionType: number;
};

export type SnappPayGatewayCart = {
  cartId: string | number;
  totalAmount: number;
  taxAmount: number;
  shippingAmount: number;
  isTaxIncluded: boolean;
  isShipmentIncluded: boolean;
  cartItems: SnappPayGatewayCartItem[];
};

function tomanToRial(amount: number) {
  return Math.max(0, Math.round(amount * 10));
}

/**
 * Per-unit item amounts (IRR) and their exact sum. SnappPay re-sums
 * amount × count, so the rest of the math MUST derive from this real sum — not
 * from invoice.subtotal — otherwise totalAmount/amount won't reconcile and the
 * gateway rejects with 400.
 */
function computeSnappPayItems(lines: SnappPayInvoiceLine[] | undefined) {
  let itemsSumRial = 0;
  const items = (lines ?? []).map((line, index) => {
    const count = Math.max(1, Math.floor(line.qty ?? line.requestedQty ?? 1));
    const lineTotalRial = tomanToRial(line.lineTotal ?? 0);
    const amount = Math.max(0, Math.floor(lineTotalRial / count));
    itemsSumRial += amount * count;
    return { index, count, amount };
  });
  return { items, itemsSumRial };
}

export function buildSnappPayAmounts(invoice: SnappPayInvoiceLike) {
  // Follow the SnappPay docs exactly:
  //   cart.totalAmount = Σ(unit × count) + shipping(not-included) + tax(not-included)
  //   amount           = Σ cart.totalAmount − discount − externalSource
  // We use flags=false (shipping/tax added on top) and make the numbers
  // reconcile to the invoice grandTotal so amount == grandTotal (no formula
  // mismatch, no 400).
  const { itemsSumRial } = computeSnappPayItems(invoice.lines);
  const subtotalRial = tomanToRial(invoice.subtotal ?? 0);
  const shippingBaseRial = tomanToRial(invoice.shippingTotal ?? 0);
  const discountAmountRial = tomanToRial(invoice.discountTotal ?? 0);
  const grandTotalRial = tomanToRial(invoice.grandTotal ?? 0);
  const externalSourceAmountRial = 0;

  // The amount SnappPay must charge is the invoice grand total (what the user
  // pays). Make shipping + tax fill exactly the gap so that
  //   amount = Σitems + shipping + tax − discount == grandTotal
  // which keeps everything internally consistent AND equal to transaction.amount
  // (no "amount formula mismatch", no 400). When grandTotal is absent, fall back
  // to subtotal − discount + shipping.
  const targetAmountRial = grandTotalRial > 0
    ? grandTotalRial
    : Math.max(0, subtotalRial - discountAmountRial + shippingBaseRial);

  const shipPlusTaxRial = Math.max(0, targetAmountRial + discountAmountRial + externalSourceAmountRial - itemsSumRial);
  // Keep the real shipping where possible; any leftover (rounding remainder /
  // VAT) becomes tax.
  const shippingAmountRial = Math.min(shippingBaseRial, shipPlusTaxRial);
  const taxAmountRial = shipPlusTaxRial - shippingAmountRial;

  const cartItemsTotalRial = itemsSumRial;
  const totalAmountRial = cartItemsTotalRial + taxAmountRial + shippingAmountRial;
  const amountRial = totalAmountRial - discountAmountRial - externalSourceAmountRial;

  return {
    amountRial,
    cartItemsTotalRial,
    taxAmountRial,
    shippingAmountRial,
    totalAmountRial,
    discountAmountRial,
    externalSourceAmountRial,
  };
}

export function buildSnappPayCartList(
  invoice: SnappPayInvoiceLike,
  categoryByProductId?: Map<string, string>,
): SnappPayGatewayCart[] {
  const amounts = buildSnappPayAmounts(invoice);
  const { items: amountItems } = computeSnappPayItems(invoice.lines);
  const items = (invoice.lines ?? []).map((line, index) => {
    const resolved = amountItems[index];
    const resolvedCategory =
      categoryByProductId?.get(String(line.productId)) ??
      (typeof line.category === 'string' ? line.category : '');
    return {
      id: index + 1,
      name: line.title,
      count: resolved.count,
      amount: resolved.amount,
      category: (resolvedCategory && resolvedCategory.trim()) || DEFAULT_CATEGORY_FA,
      commissionType: 100,
    };
  });

  return [
    {
      cartId: 1,
      totalAmount: amounts.totalAmountRial,
      taxAmount: amounts.taxAmountRial,
      shippingAmount: amounts.shippingAmountRial,
      // Shipping and tax are added ON TOP of the item amounts (not baked into
      // them), so both flags are false and totalAmount = Σitems + shipping + tax.
      isTaxIncluded: false,
      isShipmentIncluded: false,
      cartItems: items,
    },
  ];
}

export function normalizeSnappPayMobileNumber(value: string | undefined): string {
  const normalized = (value ?? '').replace(/[^\d+]/g, '');
  if (normalized.startsWith('+98') && normalized.length === 13) {
    return normalized;
  }
  if (normalized.startsWith('98') && normalized.length === 12) {
    return `+${normalized}`;
  }
  if (normalized.startsWith('09') && normalized.length === 11) {
    return `+98${normalized.slice(1)}`;
  }
  return normalized;
}
