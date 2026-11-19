'use client';

import {
  FormControl,
  FormControlLabel,
  FormHelperText,
  InputLabel,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
  Typography,
  CircularProgress,
  Stack,
} from '@mui/material';

import { useCart } from './useCart';
import { useTransportOptions } from './useTransportOptions';
import { useEffect } from 'react';

export default function CarrierSelect() {
  const { state, setTransportId, setShippingPaymentMethod } = useCart();
  const { options, isLoading, error } = useTransportOptions();

  const value = state.transportId ?? '';
  const singleOption = options.length === 1;
  const paymentMethod = state.shippingPaymentMethod ?? 'online';
  const hasOptions = options.length > 0;
  const selectedCarrier =
    options.find((carrier) => carrier.id === value) ?? (singleOption ? options[0] : undefined);

  useEffect(() => {
    if (!hasOptions) return;

    // If current selection is invalid or empty, default to first available option
    const firstOption = options[0];
    if (!firstOption) {
      setTransportId(null);
      return;
    }

    if (!value || !options.some((carrier) => carrier.id === value)) {
      setTransportId(firstOption.id);
    }
  }, [hasOptions, options, setTransportId, value]);

  useEffect(() => {
    if (!singleOption) return;
    const onlyOption = options[0];
    if (onlyOption && value !== onlyOption.id) {
      setTransportId(onlyOption.id);
    }
  }, [singleOption, options, setTransportId, value]);

  return (
    <Stack spacing={1}>
      {singleOption && selectedCarrier ? (
        null
      ) : (
        <FormControl fullWidth disabled={isLoading}>
          <InputLabel id="carrier-select-label">روش ارسال</InputLabel>
          <Select
            labelId="carrier-select-label"
            label="روش ارسال"
            value={value}
            onChange={(event) => setTransportId(event.target.value || null)}
          >
            <MenuItem value="">انتخاب نشده</MenuItem>
            {options.map((carrier) => (
              <MenuItem key={carrier.id} value={carrier.id}>
                <Typography component="span" fontWeight={600}>
                  {carrier.name}
                </Typography>
                {carrier.description ? (
                  <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                    {carrier.description}
                  </Typography>
                ) : null}
              </MenuItem>
            ))}
          </Select>
          {error ? (
            <FormHelperText error>خطا در دریافت روش‌های ارسال</FormHelperText>
          ) : !hasOptions && !isLoading ? (
            <FormHelperText>فعلاً روشی برای ارسال ثبت نشده است.</FormHelperText>
          ) : null}
        </FormControl>
      )}
      <FormControl component="fieldset">
        <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
          نحوه پرداخت هزینه ارسال
        </Typography>
        <RadioGroup
          value={paymentMethod}
          onChange={(event) => setShippingPaymentMethod(event.target.value as typeof paymentMethod)}
        >
          <FormControlLabel
            value="online"
            control={<Radio />}
            label="پرداخت هزینه ارسال در همین سایت"
          />
          <FormControlLabel
            value="on_delivery"
            control={<Radio />}
            label="پرداخت هزینه ارسال هنگام تحویل مرسوله"
          />
        </RadioGroup>
        {paymentMethod === 'on_delivery' ? (
          <FormHelperText sx={{ mt: 0 }}>
            مبلغ ارسال در جمع کل محاسبه نمی‌شود و هنگام تحویل کالا پرداخت خواهد شد.
          </FormHelperText>
        ) : null}
      </FormControl>
      {isLoading ? (
        <Stack direction="row" spacing={1} alignItems="center" color="text.secondary">
          <CircularProgress size={18} />
          <Typography variant="caption">در حال دریافت روش‌های ارسال...</Typography>
        </Stack>
      ) : null}
    </Stack>
  );
}
