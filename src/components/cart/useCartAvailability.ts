'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { loadCartAvailabilityAction } from '@/app/(public)/cart/actions';
import type { CartAvailabilityRow } from './cart-availability';

export function useCartAvailability(variantIds: string[]) {
  const [rows, setRows] = useState<CartAvailabilityRow[]>([]);
  const [loading, setLoading] = useState(false);
  const requestRef = useRef(0);
  const key = useMemo(() => Array.from(new Set(variantIds)).sort().join(','), [variantIds]);

  const load = useCallback((ids: string[]) => {
    if (ids.length === 0) {
      setRows([]);
      return;
    }
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    setLoading(true);
    void loadCartAvailabilityAction(ids)
      .then((next) => {
        if (requestRef.current === requestId) setRows(next);
      })
      .catch(() => undefined)
      .finally(() => {
        if (requestRef.current === requestId) setLoading(false);
      });
  }, []);

  useEffect(() => {
    load(key ? key.split(',') : []);
  }, [key, load]);

  useEffect(() => {
    if (!key) return;
    const onFocus = () => load(key.split(','));
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [key, load]);

  const availability = useMemo(
    () => new Map(rows.map((row) => [row.variantId, row])),
    [rows],
  );

  return {
    availability,
    loading,
    refresh: useCallback(() => load(key ? key.split(',') : []), [key, load]),
  };
}
