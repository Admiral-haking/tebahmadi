'use client';

import { useEffect } from 'react';

import { useCart } from './useCart';

export function usePaymentCleanup() {
  const { clear } = useCart();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const paid = params.get('paid');
    if (paid === 'true') {
      clear();
    }
  }, [clear]);
}
