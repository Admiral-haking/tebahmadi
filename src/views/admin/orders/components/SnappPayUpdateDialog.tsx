'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  Grid,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded';
import TrendingDownRoundedIcon from '@mui/icons-material/TrendingDownRounded';

import type { InvoiceLineView } from './InvoiceLinesTable';
import { formatToman } from '../constants';

export type SnappPayUpdatePayload = {
  discountAmountToman: number;
  externalSourceAmountToman: number;
  cartList: Array<{
    cartId: string | number;
    isShipmentIncluded: boolean;
    isTaxIncluded: boolean;
    shippingAmountToman: number;
    taxAmountToman: number;
    cartItems: Array<{
      id: string | number;
      name: string;
      count: number;
      amountToman: number;
      category: string;
      commissionType: number;
    }>;
  }>;
};

export type SnappPayUpdateSummary = {
  amountToman: number;
  cartsTotalToman: number;
  originalAmountToman: number;
};

type SnappPayUpdateDialogProps = {
  open: boolean;
  lines: InvoiceLineView[];
  defaultCartId: string | number;
  defaultDiscountAmountToman: number;
  defaultExternalSourceAmountToman: number;
  defaultShippingAmountToman: number;
  defaultTaxAmountToman: number;
  /**
   * Exact reconstruction of the original SnappPay gateway request (amounts in
   * toman). When provided it seeds the form directly, so the initial computed
   * "final amount" reconciles to the original order amount instead of being
   * re-derived from invoice fields. Falls back to building from `lines`.
   */
  initialPayload?: SnappPayUpdatePayload | null;
  originalAmountToman: number;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (payload: SnappPayUpdatePayload, summary: SnappPayUpdateSummary) => void;
};

function toNonNegativeInt(value: unknown, fallback = 0): number {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value.replace(/,/g, '').trim())
        : NaN;
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(0, Math.floor(parsed));
}

function toPositiveInt(value: unknown, fallback = 1): number {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value.replace(/,/g, '').trim())
        : NaN;
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(1, Math.floor(parsed));
}

function buildInitialPayload(input: {
  lines: InvoiceLineView[];
  defaultCartId: string | number;
  defaultDiscountAmountToman: number;
  defaultExternalSourceAmountToman: number;
  defaultShippingAmountToman: number;
  defaultTaxAmountToman: number;
}): SnappPayUpdatePayload {
  const cartItems = input.lines.map((line, index) => {
    const count = toPositiveInt(line.quantity ?? line.requestedQty ?? 1, 1);
    // Use the first non-zero unit price; otherwise derive it from the line total.
    // `??` is wrong here because a real 0 (legacy / marketplace lines that only
    // carry lineTotal) would collapse the item — and the whole order — to 0 تومان.
    const unitFromLine =
      toNonNegativeInt(line.unitPriceEffective, 0) || toNonNegativeInt(line.unitPriceBase, 0);
    const lineTotal = toNonNegativeInt(line.lineTotal, 0);
    const amountToman = unitFromLine || Math.floor(lineTotal / count);

    return {
      id: index + 1,
      name: line.title,
      count,
      amountToman,
      category: 'general',
      commissionType: 100,
    };
  });

  return {
    discountAmountToman: toNonNegativeInt(input.defaultDiscountAmountToman),
    externalSourceAmountToman: toNonNegativeInt(input.defaultExternalSourceAmountToman),
    cartList: [
      {
        cartId: input.defaultCartId,
        isShipmentIncluded: false,
        isTaxIncluded: false,
        shippingAmountToman: toNonNegativeInt(input.defaultShippingAmountToman),
        taxAmountToman: toNonNegativeInt(input.defaultTaxAmountToman),
        cartItems,
      },
    ],
  };
}

/** Normalize a parent-provided payload into a clean, editable draft. */
function sanitizePayload(payload: SnappPayUpdatePayload): SnappPayUpdatePayload {
  return {
    discountAmountToman: toNonNegativeInt(payload.discountAmountToman, 0),
    externalSourceAmountToman: toNonNegativeInt(payload.externalSourceAmountToman, 0),
    cartList: payload.cartList.map((cart) => ({
      cartId: cart.cartId,
      isShipmentIncluded: Boolean(cart.isShipmentIncluded),
      isTaxIncluded: Boolean(cart.isTaxIncluded),
      shippingAmountToman: toNonNegativeInt(cart.shippingAmountToman, 0),
      taxAmountToman: toNonNegativeInt(cart.taxAmountToman, 0),
      cartItems: cart.cartItems.map((item, index) => ({
        id: item.id || index + 1,
        name: item.name,
        count: toPositiveInt(item.count, 1),
        amountToman: toNonNegativeInt(item.amountToman, 0),
        category: item.category || 'general',
        commissionType: toPositiveInt(item.commissionType, 100),
      })),
    })),
  };
}

function seedDraft(input: {
  initialPayload?: SnappPayUpdatePayload | null;
  lines: InvoiceLineView[];
  defaultCartId: string | number;
  defaultDiscountAmountToman: number;
  defaultExternalSourceAmountToman: number;
  defaultShippingAmountToman: number;
  defaultTaxAmountToman: number;
}): SnappPayUpdatePayload {
  if (input.initialPayload && input.initialPayload.cartList.some((cart) => cart.cartItems.length > 0)) {
    return sanitizePayload(input.initialPayload);
  }
  return buildInitialPayload(input);
}

export default function SnappPayUpdateDialog({
  open,
  lines,
  defaultCartId,
  defaultDiscountAmountToman,
  defaultExternalSourceAmountToman,
  defaultShippingAmountToman,
  defaultTaxAmountToman,
  initialPayload,
  originalAmountToman,
  isSubmitting,
  onClose,
  onSubmit,
}: SnappPayUpdateDialogProps) {
  const [draft, setDraft] = useState<SnappPayUpdatePayload>(() =>
    seedDraft({
      initialPayload,
      lines,
      defaultCartId,
      defaultDiscountAmountToman,
      defaultExternalSourceAmountToman,
      defaultShippingAmountToman,
      defaultTaxAmountToman,
    }),
  );
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Keep the latest seed inputs in a ref so re-seeding reads current props
  // without making them effect dependencies (which would wipe edits mid-typing,
  // since the parent rebuilds `initialPayload` on every render).
  const seedInputsRef = useRef({
    initialPayload,
    lines,
    defaultCartId,
    defaultDiscountAmountToman,
    defaultExternalSourceAmountToman,
    defaultShippingAmountToman,
    defaultTaxAmountToman,
  });
  seedInputsRef.current = {
    initialPayload,
    lines,
    defaultCartId,
    defaultDiscountAmountToman,
    defaultExternalSourceAmountToman,
    defaultShippingAmountToman,
    defaultTaxAmountToman,
  };

  // Re-seed the form only when the dialog opens, not on every prop change.
  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setDraft(seedDraft(seedInputsRef.current));
      setShowAdvanced(false);
    }
    wasOpenRef.current = open;
  }, [open]);

  const firstCart = draft.cartList[0];

  const summary = useMemo(() => {
    const carts = draft.cartList.map((cart) => {
      const itemsSubtotal = cart.cartItems.reduce(
        (total, item) => total + toPositiveInt(item.count, 1) * toNonNegativeInt(item.amountToman, 0),
        0,
      );
      const total =
        itemsSubtotal +
        (cart.isShipmentIncluded ? 0 : toNonNegativeInt(cart.shippingAmountToman, 0)) +
        (cart.isTaxIncluded ? 0 : toNonNegativeInt(cart.taxAmountToman, 0));
      return { itemsSubtotal, total };
    });

    const cartsTotalToman = carts.reduce((total, cart) => total + cart.total, 0);
    const amountToman =
      cartsTotalToman -
      toNonNegativeInt(draft.discountAmountToman, 0) -
      toNonNegativeInt(draft.externalSourceAmountToman, 0);

    return {
      amountToman,
      cartsTotalToman,
      originalAmountToman: toNonNegativeInt(originalAmountToman, 0),
      itemsSubtotalToman: carts[0]?.itemsSubtotal ?? 0,
    };
  }, [draft, originalAmountToman]);

  const validationError = useMemo(() => {
    if (!firstCart) {
      return 'سبد خرید برای آپدیت تعریف نشده است.';
    }
    if (!firstCart.cartItems.length) {
      return 'حداقل یک آیتم باید در سبد بماند.';
    }

    for (const item of firstCart.cartItems) {
      if (!item.name.trim()) {
        return 'نام آیتم نمی‌تواند خالی باشد.';
      }
      if (!Number.isFinite(item.count) || toPositiveInt(item.count, 0) < 1) {
        return 'تعداد هر آیتم باید حداقل 1 باشد.';
      }
      if (!Number.isFinite(item.amountToman) || toNonNegativeInt(item.amountToman, -1) < 0) {
        return 'مبلغ واحد آیتم باید معتبر باشد.';
      }
      if (toNonNegativeInt(item.amountToman, 0) <= 0) {
        return 'برای حذف کامل یک آیتم، آن را از cartItems حذف کنید؛ مبلغ واحد صفر ارسال نمی‌شود.';
      }
      if (!item.category.trim()) {
        return 'دسته‌بندی آیتم نمی‌تواند خالی باشد.';
      }
      if (!Number.isFinite(item.commissionType) || toPositiveInt(item.commissionType, 0) < 1) {
        return 'نوع کمیسیون باید عدد مثبت باشد.';
      }
    }

    if (summary.amountToman <= 0) {
      return 'مبلغ نهایی آپدیت باید بیشتر از صفر باشد.';
    }

    if (summary.amountToman >= summary.originalAmountToman) {
      return 'طبق مستندات اسنپ‌پی، مبلغ آپدیت باید کمتر از مبلغ اولیه سفارش باشد.';
    }

    return null;
  }, [firstCart, summary]);

  const setCart = (
    updater: (current: SnappPayUpdatePayload['cartList'][number]) => SnappPayUpdatePayload['cartList'][number],
  ) => {
    setDraft((current) => {
      const cart = current.cartList[0];
      if (!cart) {
        return current;
      }
      return {
        ...current,
        cartList: [updater(cart)],
      };
    });
  };

  const addItem = () => {
    setCart((cart) => ({
      ...cart,
      cartItems: [
        ...cart.cartItems,
        {
          id: cart.cartItems.length + 1,
          name: '',
          count: 1,
          amountToman: 0,
          category: 'general',
          commissionType: 100,
        },
      ],
    }));
  };

  const removeItem = (index: number) => {
    setCart((cart) => ({
      ...cart,
      cartItems: cart.cartItems.filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const updateItem = (
    index: number,
    patch: Partial<SnappPayUpdatePayload['cartList'][number]['cartItems'][number]>,
  ) => {
    setCart((cart) => ({
      ...cart,
      cartItems: cart.cartItems.map((current, currentIndex) =>
        currentIndex === index ? { ...current, ...patch } : current,
      ),
    }));
  };

  const handleSubmit = () => {
    if (validationError || !firstCart) {
      return;
    }

    const payload: SnappPayUpdatePayload = {
      discountAmountToman: toNonNegativeInt(draft.discountAmountToman, 0),
      externalSourceAmountToman: toNonNegativeInt(draft.externalSourceAmountToman, 0),
      cartList: [
        {
          cartId: firstCart.cartId,
          isShipmentIncluded: firstCart.isShipmentIncluded,
          isTaxIncluded: firstCart.isTaxIncluded,
          shippingAmountToman: toNonNegativeInt(firstCart.shippingAmountToman, 0),
          taxAmountToman: toNonNegativeInt(firstCart.taxAmountToman, 0),
          cartItems: firstCart.cartItems.map((item, index) => ({
            id: item.id || index + 1,
            name: item.name.trim(),
            count: toPositiveInt(item.count, 1),
            amountToman: toNonNegativeInt(item.amountToman, 0),
            category: item.category.trim() || 'general',
            commissionType: toPositiveInt(item.commissionType, 100),
          })),
        },
      ],
    };

    onSubmit(payload, {
      amountToman: summary.amountToman,
      cartsTotalToman: summary.cartsTotalToman,
      originalAmountToman: summary.originalAmountToman,
    });
  };

  const reduction = summary.originalAmountToman - summary.amountToman;
  const amountValid = summary.amountToman > 0 && summary.amountToman < summary.originalAmountToman;
  const amountTone = amountValid ? 'success' : 'warning';

  return (
    <Dialog
      open={open}
      onClose={isSubmitting ? undefined : onClose}
      maxWidth="md"
      fullWidth
      slotProps={{ paper: { sx: { borderRadius: 3 } } }}
    >
      <DialogTitle sx={{ pb: 1.5 }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: 2,
              display: 'grid',
              placeItems: 'center',
              color: 'var(--mui-palette-primary-main)',
              bgcolor: 'rgba(var(--mui-palette-primary-mainChannel) / 0.12)',
            }}
          >
            <ReceiptLongRoundedIcon />
          </Box>
          <Stack spacing={0.25}>
            <Typography variant="h6" fontWeight={800} lineHeight={1.2}>
              ویرایش فاکتور اسنپ‌پی
            </Typography>
            <Typography variant="caption" color="text.secondary">
              اقلام و مبالغ سبد را اصلاح کنید؛ مبلغ نهایی باید کمتر از مبلغ اولیه باشد.
            </Typography>
          </Stack>
        </Stack>
      </DialogTitle>

      <DialogContent dividers sx={{ bgcolor: 'rgba(var(--mui-palette-text-primaryChannel) / 0.015)' }}>
        <Stack spacing={2.5}>
          <Alert severity="warning" variant="outlined" sx={{ borderRadius: 2 }}>
            آپدیت اسنپ‌پی برگشت‌ناپذیر است. قبل از ارسال، مقادیر را دقیق بررسی کنید.
          </Alert>

          {/* ── Live summary ── */}
          <Paper
            elevation={0}
            sx={{
              p: { xs: 2, sm: 2.5 },
              borderRadius: 3,
              border: `1px solid rgba(var(--mui-palette-${amountTone}-mainChannel) / 0.3)`,
              background: `linear-gradient(150deg, rgba(var(--mui-palette-${amountTone}-mainChannel) / 0.1) 0%, rgba(var(--mui-palette-background-paperChannel) / 0.9) 100%)`,
            }}
          >
            <Grid container spacing={2} alignItems="center">
              <Grid size={{ xs: 6, sm: 3 }}>
                <Typography variant="caption" color="text.secondary">
                  مبلغ اولیه
                </Typography>
                <Typography variant="subtitle1" fontWeight={700} sx={{ textDecoration: amountValid ? 'line-through' : 'none', opacity: amountValid ? 0.7 : 1 }}>
                  {formatToman(summary.originalAmountToman)}
                </Typography>
              </Grid>
              <Grid size={{ xs: 6, sm: 3 }}>
                <Typography variant="caption" color="text.secondary">
                  جمع سبد
                </Typography>
                <Typography variant="subtitle1" fontWeight={700}>
                  {formatToman(summary.cartsTotalToman)}
                </Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      مبلغ نهایی آپدیت
                    </Typography>
                    <Typography variant="h5" fontWeight={900} color={`var(--mui-palette-${amountTone}-main)`}>
                      {formatToman(summary.amountToman)}
                    </Typography>
                  </Box>
                  {reduction > 0 && amountValid ? (
                    <Chip
                      icon={<TrendingDownRoundedIcon />}
                      label={`${formatToman(reduction)} کاهش`}
                      color="success"
                      variant="outlined"
                      size="small"
                    />
                  ) : null}
                </Stack>
              </Grid>
            </Grid>
          </Paper>

          {firstCart ? (
            <Stack spacing={1.5}>
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="subtitle1" fontWeight={800}>
                    اقلام سبد
                  </Typography>
                  <Chip size="small" label={firstCart.cartItems.length} />
                </Stack>
                <Button startIcon={<AddRoundedIcon />} size="small" variant="outlined" onClick={addItem}>
                  افزودن آیتم
                </Button>
              </Stack>

              {firstCart.cartItems.map((item, index) => {
                const rowTotal = toPositiveInt(item.count, 1) * toNonNegativeInt(item.amountToman, 0);
                return (
                  <Paper
                    key={index}
                    variant="outlined"
                    sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: 2.5 }}
                  >
                    <Stack spacing={1.5}>
                      <Stack direction="row" spacing={1} alignItems="flex-start">
                        <Box
                          sx={{
                            mt: 0.75,
                            minWidth: 26,
                            height: 26,
                            px: 0.5,
                            borderRadius: 1.5,
                            display: 'grid',
                            placeItems: 'center',
                            fontSize: 13,
                            fontWeight: 700,
                            color: 'var(--mui-palette-primary-main)',
                            bgcolor: 'rgba(var(--mui-palette-primary-mainChannel) / 0.1)',
                          }}
                        >
                          {index + 1}
                        </Box>
                        <TextField
                          size="small"
                          fullWidth
                          label="نام کالا"
                          value={item.name}
                          error={!item.name.trim()}
                          onChange={(event) => updateItem(index, { name: event.target.value })}
                        />
                        <Tooltip title={firstCart.cartItems.length <= 1 ? 'حداقل یک آیتم باید بماند' : 'حذف آیتم'}>
                          <span>
                            <IconButton
                              color="error"
                              disabled={firstCart.cartItems.length <= 1}
                              onClick={() => removeItem(index)}
                            >
                              <DeleteRoundedIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </Stack>

                      <Grid container spacing={1.5}>
                        <Grid size={{ xs: 4, sm: 2 }}>
                          <TextField
                            size="small"
                            fullWidth
                            type="number"
                            label="تعداد"
                            value={item.count}
                            onChange={(event) => updateItem(index, { count: toPositiveInt(event.target.value, 1) })}
                          />
                        </Grid>
                        <Grid size={{ xs: 8, sm: 5 }}>
                          <TextField
                            size="small"
                            fullWidth
                            type="number"
                            label="مبلغ واحد"
                            value={item.amountToman}
                            onChange={(event) => updateItem(index, { amountToman: toNonNegativeInt(event.target.value, 0) })}
                            slotProps={{
                              input: {
                                endAdornment: <InputAdornment position="end">تومان</InputAdornment>,
                              },
                            }}
                          />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 5 }}>
                          <Box
                            sx={{
                              height: '100%',
                              minHeight: 40,
                              px: 1.5,
                              borderRadius: 1.5,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              bgcolor: 'rgba(var(--mui-palette-text-primaryChannel) / 0.04)',
                            }}
                          >
                            <Typography variant="caption" color="text.secondary">
                              جمع ردیف
                            </Typography>
                            <Typography variant="body2" fontWeight={700} sx={{ whiteSpace: 'nowrap' }}>
                              {formatToman(rowTotal)}
                            </Typography>
                          </Box>
                        </Grid>
                      </Grid>

                      <Collapse in={showAdvanced} unmountOnExit>
                        <Grid container spacing={1.5}>
                          <Grid size={{ xs: 12, sm: 4 }}>
                            <TextField
                              size="small"
                              fullWidth
                              label="شناسه آیتم"
                              value={item.id}
                              onChange={(event) => updateItem(index, { id: event.target.value })}
                            />
                          </Grid>
                          <Grid size={{ xs: 6, sm: 4 }}>
                            <TextField
                              size="small"
                              fullWidth
                              label="دسته‌بندی"
                              value={item.category}
                              error={!item.category.trim()}
                              onChange={(event) => updateItem(index, { category: event.target.value })}
                            />
                          </Grid>
                          <Grid size={{ xs: 6, sm: 4 }}>
                            <TextField
                              size="small"
                              fullWidth
                              type="number"
                              label="کمیسیون"
                              value={item.commissionType}
                              onChange={(event) => updateItem(index, { commissionType: toPositiveInt(event.target.value, 100) })}
                            />
                          </Grid>
                        </Grid>
                      </Collapse>
                    </Stack>
                  </Paper>
                );
              })}

              {/* ── Advanced cart settings ── */}
              <Button
                onClick={() => setShowAdvanced((value) => !value)}
                startIcon={<TuneRoundedIcon />}
                endIcon={
                  <ExpandMoreRoundedIcon
                    sx={{ transition: 'transform 0.2s', transform: showAdvanced ? 'rotate(180deg)' : 'none' }}
                  />
                }
                color="inherit"
                sx={{ alignSelf: 'flex-start', color: 'text.secondary' }}
              >
                تنظیمات پیشرفته سبد
              </Button>

              <Collapse in={showAdvanced} unmountOnExit>
                <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: 2.5 }}>
                  <Grid container spacing={1.5}>
                    <Grid size={{ xs: 12, sm: 4 }}>
                      <TextField
                        label="شناسه سبد"
                        size="small"
                        fullWidth
                        value={firstCart.cartId}
                        onChange={(event) => setCart((cart) => ({ ...cart, cartId: event.target.value }))}
                      />
                    </Grid>
                    <Grid size={{ xs: 6, sm: 4 }}>
                      <TextField
                        label="هزینه ارسال"
                        type="number"
                        size="small"
                        fullWidth
                        value={firstCart.shippingAmountToman}
                        onChange={(event) => setCart((cart) => ({ ...cart, shippingAmountToman: toNonNegativeInt(event.target.value, 0) }))}
                        slotProps={{ input: { endAdornment: <InputAdornment position="end">تومان</InputAdornment> } }}
                      />
                    </Grid>
                    <Grid size={{ xs: 6, sm: 4 }}>
                      <TextField
                        label="مالیات"
                        type="number"
                        size="small"
                        fullWidth
                        value={firstCart.taxAmountToman}
                        onChange={(event) => setCart((cart) => ({ ...cart, taxAmountToman: toNonNegativeInt(event.target.value, 0) }))}
                        slotProps={{ input: { endAdornment: <InputAdornment position="end">تومان</InputAdornment> } }}
                      />
                    </Grid>
                    <Grid size={{ xs: 6, sm: 4 }}>
                      <TextField
                        label="تخفیف"
                        type="number"
                        size="small"
                        fullWidth
                        value={draft.discountAmountToman}
                        onChange={(event) => setDraft((current) => ({ ...current, discountAmountToman: toNonNegativeInt(event.target.value, 0) }))}
                        slotProps={{ input: { endAdornment: <InputAdornment position="end">تومان</InputAdornment> } }}
                      />
                    </Grid>
                    <Grid size={{ xs: 6, sm: 4 }}>
                      <TextField
                        label="منبع خارجی"
                        type="number"
                        size="small"
                        fullWidth
                        value={draft.externalSourceAmountToman}
                        onChange={(event) => setDraft((current) => ({ ...current, externalSourceAmountToman: toNonNegativeInt(event.target.value, 0) }))}
                        slotProps={{ input: { endAdornment: <InputAdornment position="end">تومان</InputAdornment> } }}
                      />
                    </Grid>
                  </Grid>
                  <Divider sx={{ my: 1.5 }} />
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={firstCart.isShipmentIncluded}
                          onChange={(event) => setCart((cart) => ({ ...cart, isShipmentIncluded: event.target.checked }))}
                        />
                      }
                      label="هزینه ارسال داخل آیتم‌ها لحاظ شده"
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={firstCart.isTaxIncluded}
                          onChange={(event) => setCart((cart) => ({ ...cart, isTaxIncluded: event.target.checked }))}
                        />
                      }
                      label="مالیات داخل آیتم‌ها لحاظ شده"
                    />
                  </Stack>
                </Paper>
              </Collapse>
            </Stack>
          ) : null}

          {validationError ? (
            <Alert severity="error" sx={{ borderRadius: 2 }}>
              {validationError}
            </Alert>
          ) : null}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={isSubmitting} color="inherit">
          انصراف
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={isSubmitting || Boolean(validationError)}
        >
          ثبت آپدیت اسنپ‌پی
        </Button>
      </DialogActions>
    </Dialog>
  );
}
