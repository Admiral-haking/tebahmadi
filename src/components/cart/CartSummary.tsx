'use client';

import { ReactNode, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { Box, Button, Chip, CircularProgress, Divider, Stack, Typography } from '@mui/material';

import {
  priceCartAction,
  checkoutAndPayAction,
  checkSnappPayEligibilityAction,
  getAvailablePaymentGatewaysAction,
  type PriceCartResult,
  type SnappPayEligibilityResult,
} from '@/app/(public)/cart/actions';
import { useTransportOptions } from './useTransportOptions';

import { useCart } from './useCart';
import { useLoginDialog } from '@/auth';
import {
  CHECKOUT_ATTEMPT_STORAGE_KEY,
  CHECKOUT_GATEWAY_STORAGE_KEY,
  getOrCreateCheckoutAttemptKey,
} from './checkout-session';

import type { PaymentGateway } from '@/payments/paymentTypes';

const formatToman = (value: number) =>
  `${new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 0 }).format(Math.max(0, Math.floor(value)))} تومان`;


const computeLocalEstimate = (lines: ReturnType<typeof useCart>['lines']) => {
  return lines.reduce(
    (acc, line) => {
      const quantity =
        line.priceModel === 'per_unit'
          ? Math.max(0, line.requestedQty ?? 0)
          : Math.max(0, Math.floor(line.qty ?? 0));
      const base = (line.unitPriceBase ?? 0) * quantity;
      const discount = (line.variantOfferAmount ?? 0) * quantity;
      acc.subtotal += base - discount;
      acc.discount += discount;
      return acc;
    },
    { subtotal: 0, discount: 0 },
  );
};

const cloneState = <T,>(value: T): T => {
  const structured = (globalThis as unknown as { structuredClone?: <V>(value: V) => V }).structuredClone;
  if (typeof structured === 'function') {
    return structured(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
};

export default function CartSummary({ show, action }: { show: boolean, action: ReactNode }) {
  const { lines, state } = useCart();
  const { openLogin } = useLoginDialog();
  useTransportOptions();

  const initialEstimate = useMemo(() => computeLocalEstimate(lines), [lines]);
  const [pricingResult, setPricingResult] = useState<PriceCartResult>({ status: 'empty', estimate: initialEstimate });
  const [pricingMessage, setPricingMessage] = useState<string | null>(null);
  const [isPricingPending, startPricingTransition] = useTransition();
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [isCheckoutPending, startCheckoutTransition] = useTransition();
  const [isRedirectPending, setIsRedirectPending] = useState(false);
  const [selectedGateway, setSelectedGateway] = useState<PaymentGateway | null>(null);
  const [availableGateways, setAvailableGateways] = useState<PaymentGateway[]>([]);
  const [paymentGatewaysLoading, setPaymentGatewaysLoading] = useState(true);
  const redirectTimerRef = useRef<number | null>(null);
  const gatewayRestoredRef = useRef(false);
  const gatewayPersistenceInitializedRef = useRef(false);

  const [snappPayEligibility, setSnappPayEligibility] = useState<SnappPayEligibilityResult | null>(null);

  useEffect(() => {
    if (gatewayRestoredRef.current || typeof window === 'undefined') return;
    gatewayRestoredRef.current = true;
    const storedGateway = window.sessionStorage.getItem(CHECKOUT_GATEWAY_STORAGE_KEY);
    if (storedGateway) {
      setSelectedGateway(storedGateway as PaymentGateway);
    }
  }, []);

  useEffect(() => {
    if (!gatewayRestoredRef.current || typeof window === 'undefined') return;
    if (!gatewayPersistenceInitializedRef.current) {
      gatewayPersistenceInitializedRef.current = true;
      return;
    }
    if (selectedGateway) {
      window.sessionStorage.setItem(CHECKOUT_GATEWAY_STORAGE_KEY, selectedGateway);
    } else {
      window.sessionStorage.removeItem(CHECKOUT_GATEWAY_STORAGE_KEY);
    }
  }, [selectedGateway]);

  useEffect(() => {
    let cancelled = false;
    getAvailablePaymentGatewaysAction()
      .then((gateways) => {
        if (!cancelled) setAvailableGateways(gateways);
      })
      .catch((error) => {
        console.error('Payment gateway list failed', error);
        if (!cancelled) setAvailableGateways([]);
      })
      .finally(() => {
        if (!cancelled) setPaymentGatewaysLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (redirectTimerRef.current !== null) {
        window.clearTimeout(redirectTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    setPricingResult((prev) => ({ ...prev, estimate: computeLocalEstimate(lines) }));

    const snapshot = cloneState({
      ...state,
      lines,
    });

    const timer = setTimeout(() => {
      startPricingTransition(() => {
        priceCartAction(snapshot)
          .then((result) => {
            setPricingResult(result);
            if (result.status === 'error' || result.status === 'incomplete') {
              setPricingMessage(result.message ?? null);
            } else {
              setPricingMessage(null);
            }
          })
          .catch((error) => {
            console.error('priceCartAction failed', error);
            setPricingResult({
              status: 'error',
              estimate: computeLocalEstimate(lines),
              message: 'خطا در محاسبه مبلغ سفارش',
            });
            setPricingMessage('خطا در محاسبه مبلغ سفارش');
          });
      });
    }, 400);

    return () => clearTimeout(timer);
  }, [lines, state]);

  const grandTotal = useMemo(() => {
    if (pricingResult.status === 'success') {
      return pricingResult.totals.grandTotal;
    }
    return null;
  }, [pricingResult]);

  useEffect(() => {
    if (grandTotal === null || grandTotal <= 0) {
      setSnappPayEligibility(null);
      return;
    }

    let cancelled = false;

    checkSnappPayEligibilityAction(grandTotal)
      .then((result) => {
        if (!cancelled) {
          setSnappPayEligibility(result);
        }
      })
      .catch((error) => {
        console.error('SnappPay eligibility check failed', error);
        if (!cancelled) {
          setSnappPayEligibility({ enabled: false, reason: 'eligibility_failed' });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [grandTotal]);

  const totals = useMemo(() => {
    const estimate = pricingResult.estimate ?? computeLocalEstimate(lines);
    if (pricingResult.status === 'success') {
      return {
        subtotal: pricingResult.totals.subtotal,
        discountTotal: pricingResult.totals.discountTotal,
        shippingTotal: pricingResult.totals.shippingTotal,
        grandTotal: pricingResult.totals.grandTotal,
      };
    }
    return {
      subtotal: estimate.subtotal,
      discountTotal: estimate.discount,
      shippingTotal: 0,
      grandTotal: estimate.subtotal,
    };
  }, [pricingResult, lines]);

  const handleCheckout = (gateway: PaymentGateway) => {
    setCheckoutError(null);
    setIsRedirectPending(false);
    if (redirectTimerRef.current !== null) {
      window.clearTimeout(redirectTimerRef.current);
      redirectTimerRef.current = null;
    }
    const snapshot = cloneState({
      ...state,
      lines,
    });
    const checkoutAttemptKey = getOrCreateCheckoutAttemptKey(
      typeof window === 'undefined' ? null : window.localStorage.getItem(CHECKOUT_ATTEMPT_STORAGE_KEY),
    );
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(CHECKOUT_ATTEMPT_STORAGE_KEY, checkoutAttemptKey);
    }

    startCheckoutTransition(() => {
      checkoutAndPayAction(snapshot, gateway, checkoutAttemptKey)
        .then((result) => {
          if (result.ok) {
            if (typeof window !== 'undefined') {
              window.localStorage.removeItem(CHECKOUT_ATTEMPT_STORAGE_KEY);
            }
            if (result.redirectDelayMs && result.redirectDelayMs > 0) {
              setIsRedirectPending(true);
              redirectTimerRef.current = window.setTimeout(() => {
                window.location.href = result.redirectTo;
              }, result.redirectDelayMs);
              return;
            }

            window.location.href = result.redirectTo;
          } else if (result.authRequired) {
            // Not logged in → open the inline login modal and retry checkout
            // automatically once the user signs in (no round-trip to /auth).
            openLogin(() => handleCheckout(gateway));
          } else {
            if (typeof window !== 'undefined') {
              window.localStorage.removeItem(CHECKOUT_ATTEMPT_STORAGE_KEY);
            }
            setCheckoutError(result.error);
          }
        })
        .catch((error) => {
          console.error('checkoutAndPayAction failed', error);
          if (typeof window !== 'undefined') {
            window.localStorage.removeItem(CHECKOUT_ATTEMPT_STORAGE_KEY);
          }
          setCheckoutError('خطا در اتصال به درگاه پرداخت');
        });
    });
  };

  const hasLines = lines.length > 0;
  const pricingReady = pricingResult.status === 'success';
  const checkoutDisabled =
    !hasLines ||
    !pricingReady ||
    !selectedGateway ||
    paymentGatewaysLoading ||
    isCheckoutPending ||
    isRedirectPending;
  const shippingInfo = pricingReady ? pricingResult.shipping : null;

  type PaymentOption = {
    value: PaymentGateway;
    title: string;
    subtitle: string;
    badge?: string;
    icon: ReactNode;
    accent: string;
    accentCh: string;
    disabled?: boolean;
  };

  const basePaymentOptions: PaymentOption[] = [
      {
        value: 'zarinpal',
        title: 'پرداخت مستقیم',
        subtitle: 'پرداخت آنلاین فوری با کارت بانکی',
        badge: 'نقدی',
        icon: <Box
          component="img"
          src="/payment-logos/zarinpal.jpeg"
          alt="Zarinpal"
          sx={{
            width: 44,
            height: 44,
            objectFit: 'cover',
            display: 'block',
          }}
        />,
        accent: 'var(--mui-palette-warning-main)',
        accentCh: 'var(--mui-palette-warning-mainChannel)',
      },
      {
        value: 'torob',
        title: 'ترب‌پی',
        subtitle: 'پرداخت از طریق اعتبار و سرویس ترب',
        badge: 'اعتباری',
        icon: (
          <Box
            component="img"
            src="/payment-logos/torob.jpeg"
            alt="Torob"
            sx={{
              width: 44,
              height: 44,
              objectFit: 'cover',
              display: 'block',
            }}
          />
        ),
        accent: 'var(--mui-palette-error-main)',
        accentCh: 'var(--mui-palette-error-mainChannel)',
      },
      {
        value: 'digipay',
        title: 'دیجی‌پی',
        subtitle: 'پرداخت آنلاین از طریق درگاه دیجی‌پی',
        badge: 'آنلاین',
        icon: (
          <Box
            component="img"
            src="/payment-logos/dg.png"
            alt="Digipay"
            sx={{
              width: 44,
              height: 44,
              objectFit: 'cover',
              display: 'block',
            }}
          />
        ),
        accent: 'var(--mui-palette-primary-main)',
        accentCh: 'var(--mui-palette-primary-mainChannel)',
      },
      {
        value: 'azkivam',
        title: 'ازکی‌وام',
        subtitle: 'خرید اعتباری و پرداخت قسطی',
        badge: 'اقساطی',
        icon: (
          <Box
            component="img"
            src="/payment-logos/azkivam-logo.webp"
            alt="Azkivam"
            sx={{
              width: 44,
              height: 44,
              objectFit: 'cover',
              display: 'block',
            }}
          />
        ),
        accent: 'var(--mui-palette-secondary-main)',
        accentCh: 'var(--mui-palette-secondary-mainChannel)',
      },
    ];
  const paymentOptions: PaymentOption[] = basePaymentOptions.filter((option) =>
    availableGateways.includes(option.value),
  );

  const snappPayEnabled = snappPayEligibility?.enabled === true;
  if (snappPayEnabled && availableGateways.includes('snapppay')) {
    const installmentAmount = formatToman((grandTotal ?? 0) / 4);
    // Two-line label driven entirely by the eligibility response's
    // title_message / description (SnappPay certification requirement); fall back
    // to sensible defaults only if the response omits them.
    const eligible = snappPayEligibility as { enabled: true; title?: string; description?: string };
    const snappTitle = eligible.title?.trim() || 'خرید اقساطی با اسنپ‌پی';
    const snappSubtitle = eligible.description?.trim() || `۴ قسط به مبلغ ${installmentAmount}`;
    paymentOptions.splice(1, 0, {
      value: 'snapppay',
      title: snappTitle,
      subtitle: snappSubtitle,
      badge: 'اقساطی',
      icon: (
        <Box
          component="img"
          src="/payment-logos/snapppay.svg"
          alt="SnappPay"
          sx={{
            width: 44,
            height: 44,
            objectFit: 'contain',
            display: 'block',
          }}
        />
      ),
      accent: 'var(--mui-palette-success-main)',
      accentCh: 'var(--mui-palette-success-mainChannel)',
    });
  }

  if (availableGateways.includes('bajetpay')) {
    paymentOptions.push({
      value: 'bajetpay',
      title: 'باجت‌پی',
      subtitle: 'پرداخت آنلاین از طریق باجت‌پی',
      badge: 'آنلاین',
      icon: (
        <Typography component="span" fontWeight={900} color="inherit" sx={{ fontSize: 15 }}>
          BP
        </Typography>
      ),
      accent: 'var(--mui-palette-info-main)',
      accentCh: 'var(--mui-palette-info-mainChannel)',
    });
  }

  useEffect(() => {
    if (!paymentOptions.some((option) => option.value === selectedGateway)) {
      setSelectedGateway(paymentOptions[0]?.value ?? null);
    }
  }, [availableGateways, snappPayEnabled, selectedGateway]);

  const shippingDisplay = pricingReady
    ? shippingInfo
      ? shippingInfo.paymentMethod === 'on_delivery'
        ? `${formatToman(shippingInfo.deferredPrice)} (پرداخت در محل)`
        : formatToman(shippingInfo.chargedPrice)
      : formatToman(totals.shippingTotal)
    : 'پس از انتخاب روش';

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom fontWeight={600}>
        جمع سفارش
      </Typography>

      <Stack spacing={1.5}>
        <Line label="جمع جزء" value={formatToman(totals.subtotal + totals.discountTotal)} />
        <Line
          label="تخفیف"
          value={totals.discountTotal > 0 ? `-${formatToman(totals.discountTotal)}` : formatToman(0)}
        />
        <Line label="هزینه حمل" value={shippingDisplay} />
      </Stack>
      {pricingReady && shippingInfo?.paymentMethod === 'on_delivery' ? (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
          هزینه ارسال از مبلغ قابل پرداخت حذف شده و هنگام تحویل مرسوله تسویه می‌شود.
        </Typography>
      ) : null}

      <Divider sx={{ my: 2 }} />

      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="subtitle1" fontWeight={700}>
          قابل پرداخت
        </Typography>
        <Typography variant="h6" fontWeight={700}>
          {formatToman(totals.grandTotal)}
        </Typography>
      </Stack>

      <Stack direction="row" alignItems="center" sx={{ my: 2 }} gap={1}>
        {action}
      </Stack>

      {show ? (
        <Stack gap={1.25} sx={{ my: 1 }}>
          <Typography variant="subtitle2" fontWeight={700}>
            روش پرداخت
          </Typography>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr)',
              gap: 0.9,
            }}
          >
            {paymentOptions.map((option) => {
              const selected = selectedGateway === option.value;
              return (
                <Box
                  key={option.value}
                  component="button"
                  type="button"
                  onClick={() => {
                    if (!isCheckoutPending && !isRedirectPending && !option.disabled) {
                      setSelectedGateway(option.value);
                    }
                  }}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: { xs: 1.25, md: 1.1 },
                    width: '100%',
                    minHeight: { xs: 88, md: 78 },
                    px: { xs: 1.35, md: 1.2 },
                    py: { xs: 1.25, md: 1 },
                    borderRadius: 2.25,
                    border: '1px solid',
                    borderColor: selected ? option.accent : `rgba(${option.accentCh} / 0.27)`,
                    background: selected
                      ? `linear-gradient(135deg, rgba(${option.accentCh} / 0.18), rgba(${option.accentCh} / 0.04))`
                      : `linear-gradient(135deg, rgba(${option.accentCh} / 0.086), rgba(var(--mui-palette-text-primaryChannel) / 0.035))`,
                    boxShadow: selected
                      ? `0 10px 24px rgba(${option.accentCh} / 0.24), inset 0 1px 0 rgba(var(--mui-palette-common-backgroundChannel) / 0.55)`
                      : `0 6px 16px rgba(var(--mui-palette-text-primaryChannel) / 0.07), inset 0 1px 0 rgba(${option.accentCh} / 0.094)`,
                    textAlign: 'right',
                    cursor: isCheckoutPending || isRedirectPending || option.disabled ? 'default' : 'pointer',
                    opacity: option.disabled ? 0.72 : 1,
                    transition: 'all 160ms ease',
                    outline: 'none',
                    position: 'relative',
                    overflow: 'hidden',
                    '&:before': {
                      content: '""',
                      position: 'absolute',
                      inset: 0,
                      background: `radial-gradient(circle at 12% 18%, rgba(${option.accentCh} / 0.19), transparent 38%)`,
                      opacity: selected ? 1 : 0.55,
                      pointerEvents: 'none',
                    },
                    '&:hover': isCheckoutPending || isRedirectPending || option.disabled
                      ? undefined
                      : {
                        borderColor: option.accent,
                        transform: 'translateY(-1px)',
                        boxShadow: `0 12px 26px rgba(${option.accentCh} / 0.24), inset 0 1px 0 rgba(var(--mui-palette-common-backgroundChannel) / 0.55)`,
                      },
                  }}
                >
                  <Box
                    sx={{
                      width: { xs: 44, md: 40 },
                      height: { xs: 44, md: 40 },
                      borderRadius: 1.75,
                      display: 'grid',
                      placeItems: 'center',
                      flexShrink: 0,
                      color: option.accent,
                      overflow: 'hidden',
                      position: 'relative',
                      zIndex: 1,
                      backgroundColor: selected ? 'rgba(var(--mui-palette-common-backgroundChannel) / 0.82)' : `rgba(${option.accentCh} / 0.07)`,
                      boxShadow: `0 0 0 1px rgba(${option.accentCh} / 0.14)`,
                      '& img': {
                        width: { xs: 40, md: 36 },
                        height: { xs: 40, md: 36 },
                      },
                    }}
                  >
                    {option.icon}
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0, position: 'relative', zIndex: 1 }} dir="rtl">
                    <Stack
                      direction="row"
                      alignItems="center"
                      justifyContent="space-between"
                      gap={0.75}
                      flexWrap="nowrap"
                      sx={{ minWidth: 0 }}
                    >
                      <Typography
                        variant={option.value === 'snapppay' ? 'body1' : 'body2'}
                        fontWeight={option.value === 'snapppay' ? 900 : 800}
                        sx={{
                          color: selected ? option.accent : 'text.primary',
                          textShadow: selected ? 'none' : '0 1px 0 rgba(var(--mui-palette-common-backgroundChannel) / 0.32)',
                          // SnappPay's title_message comes from the eligible service and
                          // must show in full — let it wrap instead of truncating.
                          whiteSpace: option.value === 'snapppay' ? 'normal' : 'nowrap',
                          overflow: option.value === 'snapppay' ? 'visible' : 'hidden',
                          textOverflow: option.value === 'snapppay' ? 'clip' : 'ellipsis',
                          lineHeight: 1.65,
                          minWidth: 0,
                        }}
                      >
                        {option.title}
                      </Typography>
                      {option.badge ? (
                        <Chip
                          label={option.badge}
                          size="small"
                          sx={{
                            height: 22,
                            borderRadius: 1.25,
                            color: option.accent,
                            bgcolor: `rgba(${option.accentCh} / 0.078)`,
                            border: '1px solid',
                            borderColor: `rgba(${option.accentCh} / 0.2)`,
                            '& .MuiChip-label': {
                              px: 0.75,
                              fontSize: 11,
                              fontWeight: 800,
                            },
                            flexShrink: 0,
                          }}
                        />
                      ) : null}
                    </Stack>
                    {option.subtitle ? (
                      <Typography
                        variant={option.value === 'snapppay' ? 'body2' : 'caption'}
                        color="text.secondary"
                        sx={{
                          display: 'block',
                          mt: { xs: 0.35, md: 0.15 },
                          // SnappPay's description must show in full (second line).
                          whiteSpace: option.value === 'snapppay' ? 'normal' : 'nowrap',
                          overflow: option.value === 'snapppay' ? 'visible' : 'hidden',
                          textOverflow: option.value === 'snapppay' ? 'clip' : 'ellipsis',
                          lineHeight: 1.75,
                          color: 'text.primary',
                          opacity: 0.72,
                          fontWeight: option.value === 'snapppay' ? 700 : 400,
                        }}
                      >
                        {option.subtitle}
                      </Typography>
                    ) : null}
                  </Box>
                  <Box
                    sx={{
                      width: 16,
                      height: 16,
                      borderRadius: '50%',
                      flexShrink: 0,
                      position: 'relative',
                      zIndex: 1,
                      border: '2px solid',
                      borderColor: selected ? option.accent : 'rgba(var(--mui-palette-text-primaryChannel) / 0.3)',
                      backgroundColor: selected ? option.accent : 'transparent',
                      boxShadow: selected ? 'inset 0 0 0 3px rgba(var(--mui-palette-common-backgroundChannel) / 0.9)' : 'none',
                    }}
                  />
                </Box>
              );
            })}
          </Box>

          {paymentGatewaysLoading ? (
            <Typography variant="caption" color="text.secondary">
              در حال بررسی روش‌های پرداخت...
            </Typography>
          ) : paymentOptions.length === 0 ? (
            <Typography variant="caption" color="warning.main">
              فعلاً روش پرداخت فعالی برای این سفارش تنظیم نشده است.
            </Typography>
          ) : null}

          <Button
            variant="contained"
            size="large"
            onClick={() => {
              if (selectedGateway) handleCheckout(selectedGateway);
            }}
            disabled={checkoutDisabled}
            sx={{
              mt: 0.5,
              py: 1.35,
              borderRadius: 2.5,
              fontWeight: 800,
              fontSize: '1rem',
              boxShadow: '0 6px 16px rgba(var(--mui-palette-common-onBackgroundChannel) / 0.12)',
              transition: 'transform 0.2s ease, box-shadow 0.2s ease',
              '&:hover': {
                transform: 'translateY(-1px)',
                boxShadow: '0 10px 22px rgba(var(--mui-palette-common-onBackgroundChannel) / 0.18)',
              },
              '&:active': { transform: 'translateY(0)' },
              '&.Mui-disabled': { boxShadow: 'none', opacity: 0.6 },
            }}
            endIcon={isCheckoutPending || isRedirectPending ? <CircularProgress color="inherit" size={18} /> : null}
          >
            {isRedirectPending ? 'در حال انتقال به درگاه...' : 'پرداخت'}
          </Button>
        </Stack>
      ) : null}

      {pricingMessage ? (
        <Typography variant="caption" color="warning.main" display="block" sx={{ mt: 1 }}>
          {pricingMessage}
        </Typography>
      ) : null}

      {pricingResult.status === 'error' && !pricingMessage ? (
        <Typography variant="caption" color="error.main" display="block" sx={{ mt: 1 }}>
          {pricingResult.message}
        </Typography>
      ) : null}

      {checkoutError ? (
        <Typography variant="caption" color="error.main" display="block" sx={{ mt: 1 }}>
          {checkoutError}
        </Typography>
      ) : null}

      {state.offerCode ? (
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
          کد تخفیف فعال: {state.offerCode}
        </Typography>
      ) : null}

      {isPricingPending ? (
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
          در حال محاسبه مبلغ سفارش...
        </Typography>
      ) : null}

      {isRedirectPending ? (
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
          اتصال به درگاه پرداخت چند ثانیه زمان می‌برد...
        </Typography>
      ) : null}
    </Box>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <Stack direction="row" justifyContent="space-between" alignItems="center">
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={600}>
        {value}
      </Typography>
    </Stack>
  );
}
