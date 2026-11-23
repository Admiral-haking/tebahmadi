'use client';

// Stable feature-facing import path used by the checkout controller. The
// provider remains the compatibility boundary for existing storefront code.
export { useCart } from '@/components/cart/useCart';
export type {
  CartAddress,
  CartAttribution,
  CartLine,
  ShippingPaymentMethod,
} from '@/components/cart/useCart';
