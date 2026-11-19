'use client';

import { useMemo, useState } from 'react';
import {
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Stack,
  TextField,
  Typography,
} from '@mui/material';

import { calcOfferAmountToman } from '@/lib/offerMath';
import JalaliDateField from '@/components/jalali-date-field';

type Price = { model: 'fixed' | 'per_unit'; amount: number; unitOfMeasure?: string };
type Offer = { amount: number; startsAt?: Date; endsAt?: Date; label?: string };
type Variant = { sku: string; price: Price; offer?: Offer; active: boolean };

type OfferBulkDialogProps = {
  open: boolean;
  variants: Variant[];
  onClose: () => void;
  onApply: (variants: Variant[]) => void;
};

function parseDateTimeLocal(value: string): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    return undefined;
  }
  return date;
}

export default function OfferBulkDialog({ open, variants, onClose, onApply }: OfferBulkDialogProps) {
  const [percent, setPercent] = useState<string>('');
  const [label, setLabel] = useState<string>('');
  const [scheduleEnabled, setScheduleEnabled] = useState<boolean>(false);
  const [startsAt, setStartsAt] = useState<string>('');
  const [endsAt, setEndsAt] = useState<string>('');

  const numericPercent = useMemo(() => {
    const parsed = Number(percent);
    return Number.isFinite(parsed) ? parsed : NaN;
  }, [percent]);

  const percentError = useMemo(() => {
    if (!percent.trim()) return undefined;
    if (Number.isNaN(numericPercent) || numericPercent <= 0) {
      return 'درصد معتبر وارد کنید';
    }
    return undefined;
  }, [percent, numericPercent]);

  const hasVariantPrices = useMemo(() => variants.every((variant) => typeof variant.price?.amount === 'number'), [variants]);

  const canApply = open && !Number.isNaN(numericPercent) && numericPercent > 0 && hasVariantPrices;

  const handleClose = () => {
    setPercent('');
    setLabel('');
    setScheduleEnabled(false);
    setStartsAt('');
    setEndsAt('');
    onClose();
  };

  const handleApply = () => {
    if (!canApply) return;

    const updated = variants.map((variant) => {
      const amount = calcOfferAmountToman(variant.price.amount, numericPercent);
      const trimmedLabel = label.trim();
      const offer: Offer = {
        amount,
      };

      if (trimmedLabel) {
        offer.label = trimmedLabel;
      }

      if (scheduleEnabled) {
        const startDate = parseDateTimeLocal(startsAt);
        const endDate = parseDateTimeLocal(endsAt);
        if (startDate) {
          offer.startsAt = startDate;
        }
        if (endDate) {
          offer.endsAt = endDate;
        }
      }

      return {
        ...variant,
        offer,
      };
    });

    onApply(updated);
    handleClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle>اعمال تخفیف درصدی</DialogTitle>
      <DialogContent>
        <Stack spacing={3} sx={{ mt: 1 }}>
          <TextField
            label="درصد تخفیف"
            value={percent}
            onChange={(event) => setPercent(event.target.value)}
            type="number"
            inputProps={{ min: 0, step: 1 }}
            helperText={percentError ?? 'بر مبنای درصد اعلام شده برای تمام واریانت‌ها محاسبه می‌شود'}
            error={Boolean(percentError)}
            required
            fullWidth
          />

          <TextField label="برچسب" value={label} onChange={(event) => setLabel(event.target.value)} fullWidth />

          <Box>
            <FormControlLabel
              control={<Checkbox checked={scheduleEnabled} onChange={(event) => setScheduleEnabled(event.target.checked)} />}
              label="زمان‌بندی"
            />
            {scheduleEnabled ? (
              <Stack spacing={2} sx={{ mt: 1 }}>
                <JalaliDateField
                  label="شروع"
                  withTime
                  value={startsAt}
                  onChange={setStartsAt}
                />
                <JalaliDateField
                  label="پایان"
                  withTime
                  value={endsAt}
                  onChange={setEndsAt}
                />
              </Stack>
            ) : null}
          </Box>

          <Typography variant="body2" color="text.secondary">
            مقدار تخفیف هر واریانت متناسب با قیمت پایه آن محاسبه و به تومان ثبت می‌شود.
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>انصراف</Button>
        <Button onClick={handleApply} variant="contained" disabled={!canApply}>
          اعمال به همه
        </Button>
      </DialogActions>
    </Dialog>
  );
}
