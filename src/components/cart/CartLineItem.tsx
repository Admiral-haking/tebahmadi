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

import { BookmarkPlus, Minus, Plus, RotateCcw, X } from 'lucide-react';
import { TEB_COLORS, TEB_RADII } from '@/theme/tokens';
import { roundInventoryQuantity } from '@/lib/inventory-state';
import { useCart, type CartLine } from './useCart';
import type { CartAvailabilityRow } from './cart-availability';

const FALLBACK_IMAGE = '/product-placeholder.svg';

const formatToman = (value: number) =>
  `${new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 0 }).format(Math.max(0, Math.floor(value)))} تومان`;

const QUANTITY_FORMATTER = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 3, minimumFractionDigits: 0 });
const formatQuantity = (value: number) => QUANTITY_FORMATTER.format(value);

const toLatinDigits = (value: string) =>
  value
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)));

interface CartLineItemProps {
  line: CartLine;
  mode?: 'cart' | 'saved';
  availability?: CartAvailabilityRow;
}

export default function CartLineItem({ line, mode = 'cart', availability }: CartLineItemProps) {
  const { updateQty, updateRequestedQty, removeLine, saveForLater, moveSavedToCart, removeSavedLine } = useCart();

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
  const clientStockMax = availability?.sellable
    ? roundInventoryQuantity(Math.max(0, availability.available))
    : undefined;
  const boundedRawMax = rawMax !== undefined && clientStockMax !== undefined
    ? Math.min(rawMax, clientStockMax)
    : clientStockMax ?? rawMax;
  const max = boundedRawMax !== undefined && min !== undefined && boundedRawMax < min ? min : boundedRawMax;

  const clampPerUnit = (value: number): number | undefined => {
    if (Number.isNaN(value) || value <= 0) {
      return undefined;
    }
    let next = roundInventoryQuantity(value);
    if (min !== undefined && next < min) {
      next = min;
    }
    if (max !== undefined && next > max) {
      next = max;
    }
    return roundInventoryQuantity(next);
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
    const normalizedValue = toLatinDigits(value);
    if (line.priceModel === 'per_unit') {
      const parsed = Number(normalizedValue);
      if (Number.isNaN(parsed) || parsed <= 0) return;
      const next = clampPerUnit(parsed);
      if (next === undefined) return;
      updateRequestedQty(line.variantId, next);
    } else {
      const parsed = parseInt(normalizedValue, 10);
      if (Number.isNaN(parsed) || parsed <= 0) return;
      const next = clampFixed(parsed);
      if (next === undefined) return;
      updateQty(line.variantId, next);
    }
  };

  const qtyDisplay = line.priceModel === 'per_unit' ? line.requestedQty ?? 0 : line.qty ?? 1;
  const qtyStep = line.priceModel === 'per_unit' ? 0.001 : 1;
  const unitLabel = line.priceModel === 'per_unit' ? (line.requestedUnit ?? line.unitOfMeasure ?? '') : '';
  const canDecrease =
    line.priceModel === 'per_unit'
      ? qtyDisplay > (min ?? 0)
      : qtyDisplay > Math.max(1, Math.ceil(min ?? 1));
  const canIncrease = max === undefined || qtyDisplay < max;
  const stockNotice = (() => {
    if (mode !== 'cart' || !availability) return null;
    const unit = line.priceModel === 'per_unit' ? (line.requestedUnit ?? line.unitOfMeasure ?? '') : 'عدد';
    if (!availability.sellable || availability.available <= 0) {
      return { color: TEB_COLORS.error, text: 'این کالا در حال حاضر موجود نیست.' };
    }
    if (qtyDisplay > availability.available) {
      return {
        color: TEB_COLORS.error,
        text: `فقط ${formatQuantity(availability.available)} ${unit} قابل خرید است.`,
      };
    }
    if (availability.available <= 3 && availability.available - qtyDisplay <= 2) {
      return {
        color: TEB_COLORS.warning,
        text: `تنها ${formatQuantity(availability.available)} ${unit} در انبار باقی مانده است.`,
      };
    }
    return null;
  })();

  const thumbSrc = line.mediaThumbId
    ? line.mediaThumbId.startsWith('/') || line.mediaThumbId.startsWith('http')
      ? line.mediaThumbId
      : `/api/media/${line.mediaThumbId}`
    : FALLBACK_IMAGE;

  return (
    <Stack
      direction="row"
      flexWrap="wrap"
      spacing={2}
      sx={{
        p: 2,
        border: `1px solid ${TEB_COLORS.border}`,
        borderRadius: `${TEB_RADII.md}px`,
        bgcolor: TEB_COLORS.background,
      }}
    >
      <Box
        component="img"
        src={thumbSrc}
        alt={line.title}
        sx={{
          width: 92,
          height: 92,
          borderRadius: `${TEB_RADII.md}px`,
          objectFit: 'cover',
          border: `1px solid ${TEB_COLORS.border}`,
          bgcolor: TEB_COLORS.surfaceSoft,
        }}
      />
      <Stack flex={1} spacing={1.25} minWidth={0}>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={1.25}>
          <Stack gap={0.5} flex={1} minWidth={0}>
            <Typography variant="subtitle1" fontWeight={700} color={TEB_COLORS.textPrimary}>
              {line.title}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {(line.attributesSummary ?? '').replace(/\| weightGrams: [0-9]+/g, '')}
            </Typography>
          </Stack>

          <Stack gap={0.25} alignItems={{ xs: 'flex-start', sm: 'flex-end' }} minWidth={128}>
            {line.variantOfferAmount ? (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ textDecoration: 'line-through', fontVariantNumeric: 'tabular-nums' }}
              >
                {formatToman(baseSubtotal)}
              </Typography>
            ) : null}
            <Typography
              variant="subtitle1"
              fontWeight={800}
              color={TEB_COLORS.primaryDark}
              sx={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {formatToman(subtotal)}
            </Typography>
          </Stack>
        </Stack>

        <Stack direction="row" flexWrap="wrap" justifyContent="space-between" alignItems="center" gap={1} sx={{ width: '100%' }}>
          <Stack>
            <Stack
              direction="row"
              alignItems="center"
              sx={{
                border: `1px solid ${TEB_COLORS.border}`,
                borderRadius: `${TEB_RADII.pill}px`,
                bgcolor: '#FFFFFF',
                px: 0.5,
              }}
            >
              <IconButton
                size="small"
                aria-label={`کاهش تعداد ${line.title}`}
                onClick={handleDecrease}
                disabled={!canDecrease}
                sx={{ width: 38, height: 38, color: TEB_COLORS.primary }}
              >
                <Minus size={16} />
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
                    'aria-label': `تعداد ${line.title}`,
                    style: {
                      textAlign: 'center',
                      fontWeight: 700,
                    },
                  },
                }}
                onChange={(event) => handleManualChange(event.target.value)}
                sx={{
                  px: 0.5,
                  minWidth: 44,
                  width: 52,
                  textAlign: 'center',
                  fontVariantNumeric: 'tabular-nums',
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

              <IconButton
                size="small"
                aria-label={`افزایش تعداد ${line.title}`}
                onClick={handleIncrease}
                disabled={!canIncrease}
                sx={{ width: 38, height: 38, color: TEB_COLORS.primary }}
              >
                <Plus size={16} />
              </IconButton>
            </Stack>
            {quantityConstraintLabel ? (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                {quantityConstraintLabel}
              </Typography>
            ) : null}
            {stockNotice ? (
              <Typography variant="caption" color={stockNotice.color} sx={{ mt: 0.5 }}>
                {stockNotice.text}
              </Typography>
            ) : null}
          </Stack>

          <IconButton
            aria-label={mode === 'saved' ? `حذف ذخیره‌شده ${line.title}` : `حذف ${line.title}`}
            onClick={() => (mode === 'saved' ? removeSavedLine(line.variantId) : removeLine(line.variantId))}
            sx={{
              width: 40,
              height: 40,
              color: 'text.secondary',
              '&:hover': { color: TEB_COLORS.error, bgcolor: 'rgba(165, 74, 76, 0.08)' },
            }}
          >
            <X size={18} />
          </IconButton>
          {mode === 'cart' ? (
            <IconButton
              aria-label={`ذخیره ${line.title} برای بعد`}
              title="ذخیره برای بعد"
              onClick={() => saveForLater(line.variantId)}
              sx={{ width: 40, height: 40, color: TEB_COLORS.primary }}
            >
              <BookmarkPlus size={18} />
            </IconButton>
          ) : (
            <IconButton
              aria-label={`افزودن دوباره ${line.title} به سبد`}
              title="افزودن به سبد"
              onClick={() => moveSavedToCart(line.variantId)}
              sx={{ width: 40, height: 40, color: TEB_COLORS.primary }}
            >
              <RotateCcw size={18} />
            </IconButton>
          )}
        </Stack>
      </Stack>
    </Stack>
  );
}
