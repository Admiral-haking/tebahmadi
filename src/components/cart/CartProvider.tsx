'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
  type ReactNode,
} from 'react';

export type Unit = 'unit' | 'pair' | 'kg' | 'g' | 'lb' | 'oz' | 'l' | 'ml';

export type CartLine = {
  productId: string;
  productSlug: string;
  title: string;
  variantId: string;
  sku: string;
  priceModel: 'fixed' | 'per_unit';
  unitOfMeasure?: Unit;
  qty?: number;
  requestedQty?: number;
  requestedUnit?: Unit;
  unitPriceBase: number;
  variantOfferAmount?: number;
  mediaThumbId?: string;
  attributesSummary?: string;
  weightGramsPerUnit?: number;
  minimumOrderQuantity?: number;
  maximumOrderQuantity?: number;
};

export type CartAddress = {
  fname: string;
  lname: string;
  phone: string;
  state?: string;
  city?: string;
  address?: string;
  postalCode?: string;
};

export type ShippingPaymentMethod = 'online' | 'on_delivery';

export type CartState = {
  lines: CartLine[];
  savedLines: CartLine[];
  offerCode?: string | null;
  transportId?: string | null;
  address?: CartAddress | null;
  shippingPaymentMethod: ShippingPaymentMethod;
};

export const CART_STORAGE_KEY = 'app:cart:v1';

const normalizeOfferCode = (code: string | null | undefined): string | null => {
  const normalized = code?.trim().toUpperCase().slice(0, 40);
  return normalized || null;
};

const defaultState: CartState = {
  lines: [],
  savedLines: [],
  offerCode: null,
  transportId: null,
  address: null,
  shippingPaymentMethod: 'online',
};

type CartAction =
  | { type: 'ADD_LINE'; payload: CartLine }
  | { type: 'UPDATE_QTY'; variantId: string; qty: number }
  | { type: 'UPDATE_REQUESTED_QTY'; variantId: string; requestedQty: number }
  | { type: 'REMOVE_LINE'; variantId: string }
  | { type: 'REMOVE_UNAVAILABLE_LINES'; variantIds: string[] }
  | { type: 'SAVE_FOR_LATER'; variantId: string }
  | { type: 'MOVE_TO_CART'; variantId: string }
  | { type: 'REMOVE_SAVED_LINE'; variantId: string }
  | {
      type: 'SYNC_LINE_CONSTRAINTS';
      variantId: string;
      minimumOrderQuantity?: number;
      maximumOrderQuantity?: number;
    }
  | { type: 'CLEAR' }
  | { type: 'SET_OFFER_CODE'; code: string | null }
  | { type: 'SET_TRANSPORT_ID'; transportId: string | null }
  | { type: 'SET_ADDRESS'; address: CartAddress | null }
  | { type: 'SET_SHIPPING_PAYMENT_METHOD'; method: ShippingPaymentMethod };

const isPerUnit = (line: CartLine) => line.priceModel === 'per_unit';

const sanitizeConstraint = (value?: number): number | undefined => {
  if (typeof value !== 'number') return undefined;
  if (!Number.isFinite(value)) return undefined;
  if (value <= 0) return undefined;
  return value;
};

const normalizeConstraints = (line: CartLine) => {
  const min = sanitizeConstraint(line.minimumOrderQuantity);
  const rawMax = sanitizeConstraint(line.maximumOrderQuantity);
  const max = rawMax !== undefined && min !== undefined && rawMax < min ? min : rawMax;
  return { min, max };
};

export function applyQuantityConstraints(line: CartLine): CartLine {
  const { min, max } = normalizeConstraints(line);
  if (isPerUnit(line)) {
    let qty = line.requestedQty ?? 0;
    if (qty <= 0) {
      return {
        ...line,
        requestedQty: qty,
        minimumOrderQuantity: min,
        maximumOrderQuantity: max,
      };
    }
    if (min !== undefined && qty < min) {
      qty = min;
    }
    if (max !== undefined && qty > max) {
      qty = max;
    }
    return {
      ...line,
      requestedQty: Number(qty.toFixed(2)),
      minimumOrderQuantity: min,
      maximumOrderQuantity: max,
    };
  }

  let qty = line.qty ?? 1;
  qty = Math.max(1, Math.floor(qty));
  if (min !== undefined && qty < min) {
    qty = Math.max(qty, Math.ceil(min));
  }
  if (max !== undefined && qty > max) {
    qty = Math.min(qty, Math.floor(max));
  }

  if (qty <= 0) {
    qty = 1;
  }

  return {
    ...line,
    qty,
    minimumOrderQuantity: min,
    maximumOrderQuantity: max,
  };
}

function mergeLines(existing: CartLine, incoming: CartLine): CartLine {
  if (isPerUnit(existing)) {
    const merged: CartLine = {
      ...existing,
      requestedQty: (existing.requestedQty ?? 0) + (incoming.requestedQty ?? 0),
      requestedUnit: existing.requestedUnit ?? incoming.requestedUnit,
      minimumOrderQuantity: existing.minimumOrderQuantity ?? incoming.minimumOrderQuantity,
      maximumOrderQuantity: existing.maximumOrderQuantity ?? incoming.maximumOrderQuantity,
    };
    return applyQuantityConstraints(merged);
  }
  const merged: CartLine = {
    ...existing,
    qty: ((existing.qty ?? 0) + (incoming.qty ?? 0) || 1),
    minimumOrderQuantity: existing.minimumOrderQuantity ?? incoming.minimumOrderQuantity,
    maximumOrderQuantity: existing.maximumOrderQuantity ?? incoming.maximumOrderQuantity,
  };
  return applyQuantityConstraints(merged);
}

export function moveLineToSaved(state: CartState, variantId: string): CartState {
  const line = state.lines.find((item) => item.variantId === variantId);
  if (!line) return state;
  return {
    ...state,
    lines: state.lines.filter((item) => item.variantId !== variantId),
    savedLines: [line, ...state.savedLines.filter((item) => item.variantId !== variantId)],
  };
}

export function moveSavedLineToCart(state: CartState, variantId: string): CartState {
  const line = state.savedLines.find((item) => item.variantId === variantId);
  if (!line) return state;
  const nextState = {
    ...state,
    savedLines: state.savedLines.filter((item) => item.variantId !== variantId),
  };
  const existingIdx = nextState.lines.findIndex(
    (item) =>
      item.productId === line.productId &&
      item.variantId === line.variantId &&
      item.priceModel === line.priceModel &&
      (isPerUnit(item) ? item.requestedUnit === line.requestedUnit : true),
  );
  if (existingIdx < 0) {
    return { ...nextState, lines: [...nextState.lines, applyQuantityConstraints(line)] };
  }
  const nextLines = [...nextState.lines];
  nextLines[existingIdx] = mergeLines(nextLines[existingIdx], line);
  return { ...nextState, lines: nextLines };
}

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'ADD_LINE': {
      const incoming = applyQuantityConstraints(action.payload);
      const idx = state.lines.findIndex(
        (line) =>
          line.productId === incoming.productId &&
          line.variantId === incoming.variantId &&
          line.priceModel === incoming.priceModel &&
          (isPerUnit(line)
            ? line.requestedUnit === incoming.requestedUnit
            : true),
      );
      if (idx >= 0) {
        const nextLines = [...state.lines];
        nextLines[idx] = mergeLines(nextLines[idx], incoming);
        return { ...state, lines: nextLines };
      }
      return { ...state, lines: [...state.lines, incoming] };
    }
    case 'UPDATE_QTY': {
      const nextLines = state.lines
        .map((line) => {
          if (line.variantId !== action.variantId) return line;
          if (isPerUnit(line)) return line;
          if (action.qty <= 0) return null;
          const updated = applyQuantityConstraints({ ...line, qty: action.qty });
          return updated;
        })
        .filter(Boolean) as CartLine[];
      return { ...state, lines: nextLines };
    }
    case 'UPDATE_REQUESTED_QTY': {
      const nextLines = state.lines
        .map((line) => {
          if (line.variantId !== action.variantId) return line;
          if (!isPerUnit(line)) return line;
          if (action.requestedQty <= 0) return null;
          const updated = applyQuantityConstraints({ ...line, requestedQty: action.requestedQty });
          return updated;
        })
        .filter(Boolean) as CartLine[];
      return { ...state, lines: nextLines };
    }
    case 'REMOVE_LINE': {
      return { ...state, lines: state.lines.filter((line) => line.variantId !== action.variantId) };
    }
    case 'REMOVE_UNAVAILABLE_LINES': {
      const unavailable = new Set(action.variantIds);
      const lines = state.lines.filter((line) => !unavailable.has(line.variantId));
      return lines.length === state.lines.length ? state : { ...state, lines };
    }
    case 'SAVE_FOR_LATER': {
      return moveLineToSaved(state, action.variantId);
    }
    case 'MOVE_TO_CART': {
      return moveSavedLineToCart(state, action.variantId);
    }
    case 'REMOVE_SAVED_LINE': {
      return {
        ...state,
        savedLines: state.savedLines.filter((line) => line.variantId !== action.variantId),
      };
    }
    case 'SYNC_LINE_CONSTRAINTS': {
      const lineIdx = state.lines.findIndex((line) => line.variantId === action.variantId);
      const savedIdx = state.savedLines.findIndex((line) => line.variantId === action.variantId);
      if (lineIdx < 0 && savedIdx < 0) {
        return state;
      }
      const nextLines = [...state.lines];
      const nextSavedLines = [...state.savedLines];
      let changed = false;

      if (lineIdx >= 0) {
        const previous = nextLines[lineIdx];
        const merged = applyQuantityConstraints({
          ...previous,
          minimumOrderQuantity: action.minimumOrderQuantity ?? previous.minimumOrderQuantity,
          maximumOrderQuantity: action.maximumOrderQuantity ?? previous.maximumOrderQuantity,
        });
        if (JSON.stringify(merged) !== JSON.stringify(previous)) {
          nextLines[lineIdx] = merged;
          changed = true;
        }
      }

      if (savedIdx >= 0) {
        const previous = nextSavedLines[savedIdx];
        const merged = applyQuantityConstraints({
          ...previous,
          minimumOrderQuantity: action.minimumOrderQuantity ?? previous.minimumOrderQuantity,
          maximumOrderQuantity: action.maximumOrderQuantity ?? previous.maximumOrderQuantity,
        });
        if (JSON.stringify(merged) !== JSON.stringify(previous)) {
          nextSavedLines[savedIdx] = merged;
          changed = true;
        }
      }

      return changed ? { ...state, lines: nextLines, savedLines: nextSavedLines } : state;
    }
    case 'CLEAR': {
      return { ...defaultState };
    }
    case 'SET_OFFER_CODE': {
      return { ...state, offerCode: normalizeOfferCode(action.code) };
    }
    case 'SET_TRANSPORT_ID': {
      return { ...state, transportId: action.transportId };
    }
    case 'SET_ADDRESS': {
      return { ...state, address: action.address };
    }
    case 'SET_SHIPPING_PAYMENT_METHOD': {
      return { ...state, shippingPaymentMethod: action.method };
    }
    default:
      return state;
  }
}

function readStoredState(): CartState {
  if (typeof window === 'undefined') return defaultState;
  try {
    const stored = window.localStorage.getItem(CART_STORAGE_KEY);
    if (!stored) return defaultState;
    const parsed = JSON.parse(stored) as CartState;
    const lines = Array.isArray(parsed.lines)
      ? parsed.lines
          .map((line) => {
            try {
              return applyQuantityConstraints(line as CartLine);
            } catch {
              return null;
            }
          })
          .filter((line): line is CartLine => Boolean(line))
      : [];
    const savedLines = Array.isArray(parsed.savedLines)
      ? parsed.savedLines
          .map((line) => {
            try {
              return applyQuantityConstraints(line as CartLine);
            } catch {
              return null;
            }
          })
          .filter((line): line is CartLine => Boolean(line))
      : [];
    const shippingPaymentMethod: ShippingPaymentMethod =
      parsed.shippingPaymentMethod === 'on_delivery' ? 'on_delivery' : 'online';

    const state: CartState = {
      lines,
      savedLines,
      offerCode: normalizeOfferCode(parsed.offerCode),
      transportId: parsed.transportId ?? null,
      address: parsed.address ?? null,
      shippingPaymentMethod,
    };
    return state;
  } catch (error) {
    console.warn('Failed to parse stored cart state', error);
    return defaultState;
  }
}

type CartContextValue = {
  state: CartState;
  lines: CartLine[];
  savedLines: CartLine[];
  totalLines: number;
  itemsCount: number;
  hasPerUnit: boolean;
  addLine: (line: CartLine) => void;
  updateQty: (variantId: string, qty: number) => void;
  updateRequestedQty: (variantId: string, requestedQty: number) => void;
  removeLine: (variantId: string) => void;
  saveForLater: (variantId: string) => void;
  moveSavedToCart: (variantId: string) => void;
  removeSavedLine: (variantId: string) => void;
  clear: () => void;
  setOfferCode: (code: string | null) => void;
  setTransportId: (transportId: string | null) => void;
  setAddress: (address: CartAddress | null) => void;
  setShippingPaymentMethod: (method: ShippingPaymentMethod) => void;
  syncLineConstraints: (
    variantId: string,
    constraints: { minimumOrderQuantity?: number; maximumOrderQuantity?: number },
  ) => void;
};

const CartContext = createContext<CartContextValue | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [state, dispatch] = useReducer(cartReducer, defaultState, () => readStoredState());

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.warn('Failed to persist cart state', error);
    }
  }, [state, hydrated]);

  const addLine = useCallback((line: CartLine) => dispatch({ type: 'ADD_LINE', payload: line }), []);
  const updateQty = useCallback((variantId: string, qty: number) => dispatch({ type: 'UPDATE_QTY', variantId, qty }), []);
  const updateRequestedQty = useCallback(
    (variantId: string, requestedQty: number) => dispatch({ type: 'UPDATE_REQUESTED_QTY', variantId, requestedQty }),
    [],
  );
  const removeLine = useCallback((variantId: string) => dispatch({ type: 'REMOVE_LINE', variantId }), []);
  const saveForLater = useCallback((variantId: string) => dispatch({ type: 'SAVE_FOR_LATER', variantId }), []);
  const moveSavedToCart = useCallback((variantId: string) => dispatch({ type: 'MOVE_TO_CART', variantId }), []);
  const removeSavedLine = useCallback((variantId: string) => dispatch({ type: 'REMOVE_SAVED_LINE', variantId }), []);
  const clear = useCallback(() => dispatch({ type: 'CLEAR' }), []);
  const setOfferCode = useCallback((code: string | null) => dispatch({ type: 'SET_OFFER_CODE', code }), []);
  const setTransportId = useCallback((transportId: string | null) => dispatch({ type: 'SET_TRANSPORT_ID', transportId }), []);
  const setAddress = useCallback((address: CartAddress | null) => dispatch({ type: 'SET_ADDRESS', address }), []);
  const setShippingPaymentMethod = useCallback(
    (method: ShippingPaymentMethod) => dispatch({ type: 'SET_SHIPPING_PAYMENT_METHOD', method }),
    [],
  );
  const syncLineConstraints = useCallback(
    (variantId: string, constraints: { minimumOrderQuantity?: number; maximumOrderQuantity?: number }) =>
      dispatch({
        type: 'SYNC_LINE_CONSTRAINTS',
        variantId,
        minimumOrderQuantity: constraints.minimumOrderQuantity,
        maximumOrderQuantity: constraints.maximumOrderQuantity,
      }),
    [],
  );

  const derived = useMemo(() => {
    const totalLines = state.lines.length;
    const itemsRaw = state.lines.reduce((sum, line) => {
      if (isPerUnit(line)) {
        return sum + (line.requestedQty ?? 0);
      }
      return sum + (line.qty ?? 0);
    }, 0);
    const itemsCount = Math.max(0, Math.round(itemsRaw));
    const hasPerUnit = state.lines.some((line) => isPerUnit(line));
    return { totalLines, itemsCount, hasPerUnit };
  }, [state.lines]);

  const value = useMemo<CartContextValue>(
    () => ({
      state,
      lines: state.lines,
      savedLines: state.savedLines,
      totalLines: derived.totalLines,
      itemsCount: derived.itemsCount,
      hasPerUnit: derived.hasPerUnit,
      addLine,
      updateQty,
      updateRequestedQty,
      removeLine,
      saveForLater,
      moveSavedToCart,
      removeSavedLine,
      clear,
      setOfferCode,
      setTransportId,
      setAddress,
      setShippingPaymentMethod,
      syncLineConstraints,
    }),
    [
      state,
      derived,
      addLine,
      updateQty,
      updateRequestedQty,
      removeLine,
      saveForLater,
      moveSavedToCart,
      removeSavedLine,
      clear,
      setOfferCode,
      setTransportId,
      setAddress,
      setShippingPaymentMethod,
      syncLineConstraints,
    ],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCartContext() {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error('useCart must be used within CartProvider');
  }
  return ctx;
}

export default CartProvider;
