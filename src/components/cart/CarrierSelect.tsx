'use client';

import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import CreditCardRoundedIcon from '@mui/icons-material/CreditCardRounded';
import LocalShippingRoundedIcon from '@mui/icons-material/LocalShippingRounded';
import PaymentsRoundedIcon from '@mui/icons-material/PaymentsRounded';
import RadioButtonCheckedRoundedIcon from '@mui/icons-material/RadioButtonCheckedRounded';
import RadioButtonUncheckedRoundedIcon from '@mui/icons-material/RadioButtonUncheckedRounded';
import ReplayRoundedIcon from '@mui/icons-material/ReplayRounded';
import { Box, Button, ButtonBase, Chip, CircularProgress, FormHelperText, Stack, Typography } from '@mui/material';
import { useEffect } from 'react';

import { TEB_COLORS, TEB_RADII } from '@/theme/tokens';

import { useCart, type ShippingPaymentMethod } from './useCart';
import { useTransportOptions, type TransportOption } from './useTransportOptions';

type ChoiceCardProps = {
  id: string;
  title: string;
  description: string;
  selected: boolean;
  accent: string;
  selectedSurface: string;
  icon: typeof CreditCardRoundedIcon;
  onSelect: () => void;
};

function ChoiceCard({
  id,
  title,
  description,
  selected,
  accent,
  selectedSurface,
  icon: Icon,
  onSelect,
}: ChoiceCardProps) {
  const titleId = `${id}-title`;
  const descriptionId = `${id}-description`;

  return (
    <ButtonBase
      type="button"
      role="radio"
      aria-checked={selected}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onClick={onSelect}
      sx={{
        width: '100%',
        minHeight: 76,
        alignItems: 'stretch',
        justifyContent: 'stretch',
        textAlign: 'right',
        border: `1px solid ${selected ? accent : TEB_COLORS.border}`,
        borderRadius: `${TEB_RADII.md}px`,
        bgcolor: selected ? selectedSurface : TEB_COLORS.surface,
        color: TEB_COLORS.textPrimary,
        transition: 'background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease',
        '&:hover': {
          borderColor: accent,
          bgcolor: selected ? selectedSurface : TEB_COLORS.softSurface,
        },
        '&:focus-visible': {
          outline: `2px solid ${accent}`,
          outlineOffset: 2,
        },
        '@media (prefers-reduced-motion: reduce)': {
          transition: 'none',
        },
      }}
    >
      <Stack
        direction="row"
        spacing={1.25}
        alignItems="center"
        sx={{ width: '100%', minWidth: 0, p: { xs: 1.25, sm: 1.5 } }}
      >
        <Box
          sx={{
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
            width: 28,
            height: 28,
            color: selected ? accent : TEB_COLORS.textSecondary,
          }}
        >
          {selected ? (
            <RadioButtonCheckedRoundedIcon fontSize="small" aria-hidden="true" />
          ) : (
            <RadioButtonUncheckedRoundedIcon fontSize="small" aria-hidden="true" />
          )}
        </Box>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography
            id={titleId}
            variant="body2"
            fontWeight={800}
            sx={{ overflowWrap: 'anywhere' }}
          >
            {title}
          </Typography>
          <Typography
            id={descriptionId}
            variant="caption"
            color={TEB_COLORS.textSecondary}
            sx={{ display: 'block', mt: 0.35, overflowWrap: 'anywhere' }}
          >
            {description}
          </Typography>
        </Box>
        <Box
          sx={{
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
            width: 34,
            height: 34,
            borderRadius: `${TEB_RADII.sm}px`,
            bgcolor: selected ? accent : TEB_COLORS.softSurface,
            color: selected ? TEB_COLORS.surface : accent,
          }}
        >
          <Icon fontSize="small" aria-hidden="true" />
        </Box>
      </Stack>
    </ButtonBase>
  );
}

function CarrierCard({
  carrier,
  selected,
  singleOption,
  onSelect,
}: {
  carrier: TransportOption;
  selected: boolean;
  singleOption: boolean;
  onSelect: () => void;
}) {
  const titleId = `carrier-${carrier.id}-title`;
  const descriptionId = `carrier-${carrier.id}-description`;

  return (
    <ButtonBase
      type="button"
      role="radio"
      aria-checked={selected}
      aria-labelledby={titleId}
      aria-describedby={carrier.description ? descriptionId : undefined}
      onClick={onSelect}
      sx={{
        width: '100%',
        minHeight: 68,
        alignItems: 'stretch',
        justifyContent: 'stretch',
        textAlign: 'right',
        border: `1px solid ${selected ? TEB_COLORS.primary : TEB_COLORS.border}`,
        borderRadius: `${TEB_RADII.md}px`,
        bgcolor: selected ? '#EAF4EE' : TEB_COLORS.surface,
        color: TEB_COLORS.textPrimary,
        transition: 'background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease',
        '&:hover': {
          borderColor: TEB_COLORS.primary,
          bgcolor: '#EAF4EE',
        },
        '&:focus-visible': {
          outline: `2px solid ${TEB_COLORS.primary}`,
          outlineOffset: 2,
        },
        '@media (prefers-reduced-motion: reduce)': {
          transition: 'none',
        },
      }}
    >
      <Stack
        direction="row"
        spacing={1.25}
        alignItems="center"
        sx={{ width: '100%', minWidth: 0, p: { xs: 1.25, sm: 1.5 } }}
      >
        <Box
          sx={{
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
            width: 28,
            height: 28,
            color: selected ? TEB_COLORS.primary : TEB_COLORS.textSecondary,
          }}
        >
          {selected ? (
            <RadioButtonCheckedRoundedIcon fontSize="small" aria-hidden="true" />
          ) : (
            <RadioButtonUncheckedRoundedIcon fontSize="small" aria-hidden="true" />
          )}
        </Box>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography id={titleId} variant="body2" fontWeight={800} sx={{ overflowWrap: 'anywhere' }}>
            {carrier.name}
          </Typography>
          {carrier.description ? (
            <Typography
              id={descriptionId}
              variant="caption"
              color={TEB_COLORS.textSecondary}
              sx={{ display: 'block', mt: 0.25, overflowWrap: 'anywhere' }}
            >
              {carrier.description}
            </Typography>
          ) : null}
        </Box>
        <Box
          sx={{
            flexShrink: 0,
            px: 1.25,
            py: 0.75,
            minHeight: 38,
            display: 'inline-flex',
            alignItems: 'center',
            borderRadius: `${TEB_RADII.sm}px`,
            bgcolor: selected ? TEB_COLORS.primary : TEB_COLORS.softSurface,
            color: selected ? TEB_COLORS.surface : TEB_COLORS.primary,
          }}
        >
          <Typography variant="caption" fontWeight={700} sx={{ whiteSpace: 'nowrap' }}>
            {singleOption ? 'خودکار' : selected ? 'انتخاب شده' : 'انتخاب روش'}
          </Typography>
        </Box>
      </Stack>
    </ButtonBase>
  );
}

const paymentOptions: Array<{
  value: ShippingPaymentMethod;
  title: string;
  description: string;
  icon: typeof CreditCardRoundedIcon;
  accent: string;
  selectedSurface: string;
}> = [
  {
    value: 'online',
    title: 'پرداخت هزینه ارسال در همین سایت',
    description: 'هزینه ارسال همراه با مبلغ سفارش در همین سایت پرداخت می‌شود.',
    icon: CreditCardRoundedIcon,
    accent: TEB_COLORS.error,
    selectedSurface: TEB_COLORS.errorSoft,
  },
  {
    value: 'on_delivery',
    title: 'پرداخت هزینه ارسال هنگام تحویل مرسوله',
    description: 'فقط هزینه ارسال را هنگام تحویل مرسوله پرداخت می‌کنید.',
    icon: PaymentsRoundedIcon,
    accent: TEB_COLORS.primary,
    selectedSurface: '#EAF4EE',
  },
];

export default function CarrierSelect() {
  const { state, setTransportId, setShippingPaymentMethod } = useCart();
  const { options, isLoading, error, retry } = useTransportOptions();

  const value = state.transportId ?? '';
  const singleOption = options.length === 1;
  const paymentMethod = state.shippingPaymentMethod ?? 'online';
  const hasOptions = options.length > 0;
  const showLoadError = Boolean(error) && !hasOptions;
  const selectedCarrier =
    options.find((carrier) => carrier.id === value) ?? (singleOption ? options[0] : undefined);

  useEffect(() => {
    if (!hasOptions) return;

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
    <Box
      component="section"
      aria-labelledby="shipping-method-title"
      sx={{
        border: `1px solid ${TEB_COLORS.primary}`,
        borderRadius: `${TEB_RADII.lg}px`,
        bgcolor: '#F4FAF6',
        p: { xs: 1.5, sm: 2 },
        overflow: 'hidden',
      }}
    >
      <Stack spacing={2}>
        <Stack spacing={0.5}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1}
            alignItems={{ xs: 'flex-start', sm: 'center' }}
            justifyContent="space-between"
          >
            <Stack direction="row" spacing={1} alignItems="center" minWidth={0}>
              <Box
                sx={{
                  display: 'grid',
                  placeItems: 'center',
                  width: 34,
                  height: 34,
                  flexShrink: 0,
                  borderRadius: `${TEB_RADII.sm}px`,
                  bgcolor: '#DCEFE2',
                  color: TEB_COLORS.primary,
                }}
              >
                <LocalShippingRoundedIcon fontSize="small" aria-hidden="true" />
              </Box>
              <Typography
                id="shipping-method-title"
                variant="subtitle1"
                fontWeight={800}
                sx={{ overflowWrap: 'anywhere' }}
              >
                روش و هزینه ارسال
              </Typography>
            </Stack>
            {selectedCarrier ? (
              <Chip
                size="small"
                icon={<CheckCircleRoundedIcon aria-hidden="true" />}
                label="انتخاب شده"
                sx={{
                  minHeight: 34,
                  bgcolor: TEB_COLORS.primary,
                  color: TEB_COLORS.surface,
                  '& .MuiChip-icon': { color: TEB_COLORS.surface },
                }}
              />
            ) : null}
          </Stack>
          <Typography variant="caption" color={TEB_COLORS.textSecondary}>
            روش حمل و وزن بسته را مشخص کنید.
          </Typography>
        </Stack>

        <Box component="fieldset" sx={{ border: 0, m: 0, minWidth: 0, p: 0 }}>
          <Typography component="legend" variant="body2" fontWeight={800} sx={{ mb: 1 }}>
            روش ارسال
          </Typography>
          {isLoading && !hasOptions ? (
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              sx={{
                minHeight: 68,
                p: 1.5,
                border: `1px solid ${TEB_COLORS.border}`,
                borderRadius: `${TEB_RADII.md}px`,
              }}
            >
              <CircularProgress size={20} sx={{ color: TEB_COLORS.primary }} />
              <Typography variant="body2" color={TEB_COLORS.textSecondary}>
                در حال دریافت روش‌های ارسال...
              </Typography>
            </Stack>
          ) : hasOptions ? (
            <Box role="radiogroup" aria-label="روش ارسال">
              <Stack spacing={1}>
                {options.map((carrier) => (
                  <CarrierCard
                    key={carrier.id}
                    carrier={carrier}
                    selected={carrier.id === selectedCarrier?.id}
                    singleOption={singleOption}
                    onSelect={() => setTransportId(carrier.id)}
                  />
                ))}
              </Stack>
            </Box>
          ) : showLoadError ? (
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1.25}
              alignItems={{ xs: 'stretch', sm: 'center' }}
              justifyContent="space-between"
              sx={{
                minHeight: 68,
                p: 1.5,
                border: `1px solid ${TEB_COLORS.error}`,
                borderRadius: `${TEB_RADII.md}px`,
                bgcolor: TEB_COLORS.errorSoft,
              }}
            >
              <FormHelperText error sx={{ m: 0 }}>
                روش‌های ارسال موقتاً در دسترس نیست؛ لطفاً دوباره تلاش کنید.
              </FormHelperText>
              <Button
                type="button"
                variant="outlined"
                size="small"
                startIcon={<ReplayRoundedIcon aria-hidden="true" />}
                onClick={retry}
                sx={{ alignSelf: { xs: 'stretch', sm: 'center' }, minHeight: 44, flexShrink: 0 }}
              >
                تلاش دوباره
              </Button>
            </Stack>
          ) : (
            <FormHelperText sx={{ m: 0 }}>فعلاً روشی برای ارسال ثبت نشده است.</FormHelperText>
          )}
        </Box>

        <Box component="fieldset" sx={{ border: 0, m: 0, minWidth: 0, p: 0 }}>
          <Typography component="legend" variant="body2" fontWeight={800} sx={{ mb: 1 }}>
            زمان پرداخت هزینه ارسال
          </Typography>
          <Box role="radiogroup" aria-label="زمان پرداخت هزینه ارسال">
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' },
                gap: 1,
              }}
            >
              {paymentOptions.map((option) => (
                <ChoiceCard
                  key={option.value}
                  id={`shipping-payment-${option.value}`}
                  title={option.title}
                  description={option.description}
                  selected={paymentMethod === option.value}
                  accent={option.accent}
                  selectedSurface={option.selectedSurface}
                  icon={option.icon}
                  onSelect={() => setShippingPaymentMethod(option.value)}
                />
              ))}
            </Box>
          </Box>
          {paymentMethod === 'on_delivery' ? (
            <FormHelperText sx={{ mt: 1, mx: 0 }}>
              مبلغ ارسال در جمع کل محاسبه نمی‌شود و هنگام تحویل کالا پرداخت خواهد شد.
            </FormHelperText>
          ) : null}
        </Box>

        {isLoading && hasOptions ? (
          <Stack direction="row" spacing={1} alignItems="center" color={TEB_COLORS.textSecondary}>
            <CircularProgress size={16} sx={{ color: TEB_COLORS.primary }} />
            <Typography variant="caption">در حال به‌روزرسانی روش‌های ارسال...</Typography>
          </Stack>
        ) : null}
      </Stack>
    </Box>
  );
}
