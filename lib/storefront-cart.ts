export type StorefrontVariant = {
  id: string;
  title?: string;
  price_toman?: number;
  available_quantity?: number;
  compare_at_toman?: number | null;
};

export type StorefrontProduct = {
  id: string;
  name: string;
  price?: number;
  stock?: number;
  variants?: StorefrontVariant[];
};

export type ResolvedCartLine = {
  key: string;
  product: StorefrontProduct;
  variant: StorefrontVariant;
  quantity: number;
};

export function cartLineKey(productId: string, variantId?: string | null): string {
  return variantId || productId;
}

export function resolveCartLines(cart: Record<string, number>, products: StorefrontProduct[]): ResolvedCartLine[] {
  const lines: ResolvedCartLine[] = [];
  for (const [key, rawQuantity] of Object.entries(cart)) {
    const quantity = Math.floor(Number(rawQuantity));
    if (!Number.isSafeInteger(quantity) || quantity <= 0) continue;
    const product = products.find((item) => item.id === key || item.variants?.some((variant) => variant.id === key));
    if (!product) continue;
    const variant = product.variants?.find((item) => item.id === key) || product.variants?.[0];
    if (!variant) continue;
    lines.push({ key, product, variant, quantity });
  }
  return lines;
}
