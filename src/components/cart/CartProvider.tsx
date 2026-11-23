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

import {
  applyQuantityConstraints,
  type CartAddress,
  type CartAttribution,
  type CartLine,
  type CartState,
  type ShippingPaymentMethod,
  type Unit,
} from '@/features/cart/cart-domain';
import { reconcileCartAvailabilityAction } from '@/app/(public)/cart/actions';
import { toast } from 'sonner';

export type {
  CartAddress,
  CartAttribution,
  CartLine,
  CartState,
  ShippingPaymentMethod,
  Unit,
} from '@/features/cart/cart-domain';

export const CART_STORAGE_KEY = 'app:cart:v1';
export const CART_UPDATED_AT_STORAGE_KEY = 'app:cart:updated-at:v1';
export const CART_RECOVERY_DISMISSED_UNTIL_STORAGE_KEY = 'app:cart:recovery-dismissed-until:v1';

const isMongoObjectId = (value: string) => /^[a-f\d]{24}$/i.test(value);

const normalizeOfferCode = (code: string | null | undefined): string | null => {
  const normalized = code?.trim().toUpperCase().slice(0, 40);
  return normalized || null;
};

function normalizeAttribution(value: unknown): CartAttribution | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const record = value as Record<string, unknown>;
  const campaign = typeof record.campaign === 'string' ? record.campaign.trim().slice(0, 120) : undefined;
  const source = typeof record.source === 'string' ? record.source.trim().slice(0, 120) : undefined;
  const medium = typeof record.medium === 'string' ? record.medium.trim().slice(0, 120) : undefined;
  if (!campaign && !source && !medium) return undefined;
  return { campaign, source, medium };
}

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
  | { type: 'SET_SHIPPING_PAYMENT_METHOD'; method: ShippingPaymentMethod }
  | { type: 'SET_ATTRIBUTION'; attribution: CartAttribution | undefined };

const isPerUnit = (line: CartLine) => line.priceModel === 'per_unit';

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
    case 'SET_ATTRIBUTION': {
      return { ...state, attribution: action.attribution };
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
      attribution: normalizeAttribution(parsed.attribution),
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
  setAttribution: (attribution: CartAttribution | undefined) => void;
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
      window.localStorage.setItem(CART_UPDATED_AT_STORAGE_KEY, String(Date.now()));
    } catch (error) {
      console.warn('Failed to persist cart state', error);
    }
  }, [state, hydrated]);

  useEffect(() => {
    if (!hydrated || state.lines.length === 0) return;
    let cancelled = false;
    const reconcile = async () => {
      const variantIds = state.lines
        .map((line) => line.variantId)
        .filter((variantId) => isMongoObjectId(variantId));
      if (variantIds.length === 0) return;
      const result = await reconcileCartAvailabilityAction(variantIds);
      if (!cancelled && result.ok && result.unavailableVariantIds.length > 0) {
        dispatch({ type: 'REMOVE_UNAVAILABLE_LINES', variantIds: result.unavailableVariantIds });
        toast.error('برخی کالاهای ناموجود از سبد خرید حذف شدند.');
      }
    };
    void reconcile().catch(() => undefined);
    const onFocus = () => void reconcile().catch(() => undefined);
    window.addEventListener('focus', onFocus);
    const timer = window.setInterval(onFocus, 60_000);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', onFocus);
      window.clearInterval(timer);
    };
  }, [hydrated, state.lines]);

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
  const setAttribution = useCallback(
    (attribution: CartAttribution | undefined) => dispatch({ type: 'SET_ATTRIBUTION', attribution: normalizeAttribution(attribution) }),
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
      setAttribution,
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
      setAttribution,
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
