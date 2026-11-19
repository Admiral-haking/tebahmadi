'use client';

import { useMemo } from 'react';
import {
  Box,
  Grid,
  IconButton,
  Stack,
  TextField,
  Typography,
  InputAdornment,
  InputBase,
} from '@mui/material';

import { useCart, type CartLine } from './useCart';

const FALLBACK_IMAGE =
  'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2296%22 height=%2296%22 viewBox=%220 0 96 96%22%3E%3Crect width=%2296%22 height=%2296%22 rx=%2212%22 fill=%22%23f0f0f0%22/%3E%3Cpath d=%22M24 68h48a4 4 0 0 0 3.2-6.4l-16-21.333a4 4 0 0 0-6.4 0L36 60l-6.4-8.533a4 4 0 0 0-6.4 0L20 62a4 4 0 0 0 4 6Z%22 fill=%22%23d0d0d0%22/%3E%3Ccircle cx=%2236%22 cy=%2230%22 r=%228%22 fill=%22%23d0d0d0%22/%3E%3C/svg%3E';

const formatToman = (value: number) =>
  `${new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 0 }).format(Math.max(0, Math.floor(value)))} تومان`;

const QUANTITY_FORMATTER = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 2, minimumFractionDigits: 0 });
const formatQuantity = (value: number) => QUANTITY_FORMATTER.format(value);

interface CartLineItemProps {
  line: CartLine;
}

export default function CartLineItem({ line }: CartLineItemProps) {
  const { updateQty, updateRequestedQty, removeLine } = useCart();

  const effectiveUnitPrice = useMemo(() => {
    const discount = line.variantOfferAmount ?? 0;
    return line.unitPriceBase - discount;
  }, [line.unitPriceBase, line.variantOfferAmount]);

  const { subtotal, baseSubtotal } = useMemo(() => {
    const qty = line.priceModel === 'per_unit' ? line.requestedQty ?? 0 : line.qty ?? 1;
    const base = (line.unitPriceBase ?? 0) * qty;
    const effective = effectiveUnitPrice * qty;
    return { subtotal: effective, baseSubtotal: base };
  }, [line.priceModel, line.qty, line.requestedQty, line.unitPriceBase, effectiveUnitPrice]);

  const min =
    typeof line.minimumOrderQuantity === 'number' && line.minimumOrderQuantity > 0
      ? line.minimumOrderQuantity
      : undefined;
  const rawMax =
    typeof line.maximumOrderQuantity === 'number' && line.maximumOrderQuantity > 0
      ? line.maximumOrderQuantity
      : undefined;
  const max = rawMax !== undefined && min !== undefined && rawMax < min ? min : rawMax;

  const clampPerUnit = (value: number): number | undefined => {
    if (Number.isNaN(value) || value <= 0) {
      return undefined;
    }
    let next = Number(value.toFixed(2));
    if (min !== undefined && next < min) {
      next = min;
    }
    if (max !== undefined && next > max) {
      next = max;
    }
    return Number(next.toFixed(2));
  };

  const clampFixed = (value: number): number | undefined => {
    if (Number.isNaN(value) || value <= 0) {
      return undefined;
    }
    let next = Math.max(1, Math.floor(value));
    if (min !== undefined && next < min) {
      next = Math.max(Math.ceil(min), 1);
    }
    if (max !== undefined && next > max) {
      next = Math.max(Math.floor(max), 1);
    }
    return next;
  };

  const quantityConstraintLabel = (() => {
    if (!min && !max) {
      return undefined;
    }
    const unitLabel =
      line.priceModel === 'per_unit' && (line.requestedUnit ?? line.unitOfMeasure)
        ? ` ${line.requestedUnit ?? line.unitOfMeasure}`
        : '';
    if (min && max) {
      return `حداقل ${formatQuantity(min)} و حداکثر ${formatQuantity(max)} در هر سفارش${unitLabel}`;
    }
    if (min) {
      return `حداقل سفارش: ${formatQuantity(min)}${unitLabel}`;
    }
    return max ? `حداکثر سفارش: ${formatQuantity(max)}${unitLabel}` : undefined;
  })();

  const handleIncrease = () => {
    if (line.priceModel === 'per_unit') {
      const current = line.requestedQty ?? 0;
      const next = clampPerUnit(current + 0.5);
      if (next === undefined) return;
      updateRequestedQty(line.variantId, next);
    } else {
      const current = line.qty ?? 1;
      const next = clampFixed(current + 1);
      if (next === undefined) return;
      updateQty(line.variantId, next);
    }
  };

  const handleDecrease = () => {
    if (line.priceModel === 'per_unit') {
      const current = line.requestedQty ?? 0;
      const nextRaw = current - 0.5;
      if (nextRaw <= 0) {
        removeLine(line.variantId);
      } else {
        const next = clampPerUnit(nextRaw);
        if (next === undefined || next <= 0) {
          removeLine(line.variantId);
        } else {
          updateRequestedQty(line.variantId, next);
        }
      }
    } else {
      const current = line.qty ?? 1;
      const nextCandidate = current - 1;
      if (nextCandidate <= 0) {
        removeLine(line.variantId);
      } else {
        const next = clampFixed(nextCandidate);
        if (next === undefined || next <= 0) {
          removeLine(line.variantId);
        } else {
          updateQty(line.variantId, next);
        }
      }
    }
  };

  const handleManualChange = (value: string) => {
    if (line.priceModel === 'per_unit') {
      const parsed = Number(value);
      if (Number.isNaN(parsed) || parsed <= 0) return;
      const next = clampPerUnit(parsed);
      if (next === undefined) return;
      updateRequestedQty(line.variantId, next);
    } else {
      const parsed = parseInt(value, 10);
      if (Number.isNaN(parsed) || parsed <= 0) return;
      const next = clampFixed(parsed);
      if (next === undefined) return;
      updateQty(line.variantId, next);
    }
  };

  const qtyDisplay = line.priceModel === 'per_unit' ? line.requestedQty ?? 0 : line.qty ?? 1;
  const qtyStep = line.priceModel === 'per_unit' ? 0.5 : 1;
  const unitLabel = line.priceModel === 'per_unit' ? (line.requestedUnit ?? line.unitOfMeasure ?? '') : '';

  return (
    <Stack direction="row" flexWrap="wrap" spacing={2} sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
      <Box
        component="img"
        src={line.mediaThumbId ? `/api/media/${line.mediaThumbId}` : FALLBACK_IMAGE}
        alt={line.title}
        sx={{
          width: 96,
          height: 96,
          borderRadius: 2,
          objectFit: 'cover',
          border: '1px solid',
          borderColor: 'divider',
        }}
      />
      <Stack flex={1} flexWrap="wrap">
        <Stack direction={{ xs: 'column', sm: 'row' }} flexWrap="wrap" gap={2}>
          <Stack gap={1} flex={1} minWidth={0}>
            <Typography variant="subtitle1" fontWeight={600}>
              {line.title}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {(line.attributesSummary ?? '').replace(/\| weightGrams: [0-9]+/g, "")}
            </Typography>
          </Stack>

          <Stack gap={0.5} alignItems="flex-end" minWidth={140}>
            {line.variantOfferAmount ? (
              <Typography variant="body2" color="text.secondary" sx={{ textDecoration: 'line-through' }}>
                {formatToman(baseSubtotal)}
              </Typography>
            ) : null}
            <Typography variant="subtitle1" fontWeight={600}>
              {formatToman(subtotal)}
            </Typography>
          </Stack>
        </Stack>

        <Stack direction="row" flexWrap="wrap" justifyContent="space-between" alignItems="center" gap={1} sx={{ width: '100%' }}>
          <Stack>
            <Stack direction="row" alignItems="center" flexWrap="wrap">
              <IconButton size="small" aria-label="کاهش" onClick={handleDecrease} sx={{ fontSize: '1.1rem' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width={18} height={18} viewBox="0 0 24 24">
                  <path fill="currentColor" d="M19 12.998H5v-2h14z"></path>
                </svg>
              </IconButton>
              <InputBase
                value={qtyDisplay}
                type="number"
                slotProps={{
                  input: {
                    min: line.priceModel === 'per_unit' ? min ?? undefined : Math.max(1, Math.ceil(min ?? 1)),
                    max: max === undefined ? undefined : line.priceModel === 'per_unit' ? max : Math.floor(max),
                    step: qtyStep,
                    inputMode: 'decimal',
                    dir: 'ltr',
                    style: {
                      textAlign: 'center',
                    },
                  },
                }}
                onChange={(event) => handleManualChange(event.target.value)}
                sx={{
                  p: 1,
                  minWidth: 50,
                  width: 60,
                  textAlign: 'center',

                  '& input[type=number]': {
                    MozAppearance: 'textfield',
                  },
                  '& input[type=number]::-webkit-outer-spin-button': {
                    WebkitAppearance: 'none',
                    margin: 0,
                  },
                  '& input[type=number]::-webkit-inner-spin-button': {
                    WebkitAppearance: 'none',
                    margin: 0,
                  },
                }}
              />
              {!!unitLabel && <InputAdornment position="end">{unitLabel}</InputAdornment>}

              <IconButton size="small" aria-label="افزایش" onClick={handleIncrease} sx={{ fontSize: '1.1rem' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width={18} height={18} viewBox="0 0 24 24">
                  <path fill="currentColor" d="M18 12.998h-5v5a1 1 0 0 1-2 0v-5H6a1 1 0 0 1 0-2h5v-5a1 1 0 0 1 2 0v5h5a1 1 0 0 1 0 2"></path>
                </svg>
              </IconButton>
            </Stack>
            {quantityConstraintLabel ? (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                {quantityConstraintLabel}
              </Typography>
            ) : null}
          </Stack>

          <IconButton aria-label="حذف" onClick={() => removeLine(line.variantId)} sx={{ fontSize: '1.2rem' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24">
              <path fill="currentColor" d="M19 6.41L17.59 5L12 10.59L6.41 5L5 6.41L10.59 12L5 17.59L6.41 19L12 13.41L17.59 19L19 17.59L13.41 12z"></path>
            </svg>
          </IconButton>
        </Stack>
      </Stack>
    </Stack>
  );
}
