"use client";

import React from "react";
import {
  Box,
  Typography,
  Stack,
  Paper,
  Divider,
  Stepper,
  Step,
  StepLabel,
  Tooltip,
  Chip,
  IconButton,
  Button,
  Grid,
  Container,
  Skeleton,
  ButtonBase
} from "@mui/material";
import { ShoppingBag, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

import { useCart, type CartLine } from "./useCart";
import CartLineItem from "./CartLineItem";
import OfferInput from "./OfferInput";
import CarrierSelect from "./CarrierSelect";
import AddressForm from "./AddressForm";
import CartSummary from "./CartSummary";
import CartPaymentContext from "./CartPaymentContext";
import SavedCartLines from "./SavedCartLines";
import { useCartAvailability } from "./useCartAvailability";
import { usePaymentCleanup } from "./usePaymentCleanup";
import { CHECKOUT_STEP_STORAGE_KEY } from "./checkout-session";
import { EmptyState } from "@/components/ui";
import { TEB_COLORS, TEB_RADII } from "@/theme/tokens";
import { logCartRecommendationEvents } from "./cart-suggestions.api";
import { useAuth, useLoginDialog } from "@/auth";
import { requiresCartLogin } from "@/features/cart/cart-auth";

export type UpsellProduct = {
  id: string;
  slug: string;
  title: string;
  finalPrice: number;
  originalPrice?: number;
  discountPercent?: number;
  inStock: boolean;
  imageUrl?: string;
  algo?: "copurchase" | "category" | "curated" | "explicit_bundle";
  line: CartLine;
};

type UpsellProductResponse = {
  products: UpsellProduct[];
};

const UPSELL_FALLBACK_IMAGE = "/product-placeholder.svg";
const PRICE_FORMATTER = new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 0 });

const formatPrice = (value: number) => `${PRICE_FORMATTER.format(Math.max(0, Math.floor(value)))} تومان`;

type VariantConstraint = {
  minimumOrderQuantity?: number;
  maximumOrderQuantity?: number;
};

const isPositiveNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;

const normalizeConstraintValue = (value: unknown): number | undefined => (isPositiveNumber(value) ? value : undefined);

const collectVariantIdentityKeys = (variant: Record<string, unknown>): string[] => {
  const keys = new Set<string>();
  (["id", "_id", "sku"] as const).forEach((key) => {
    const raw = variant[key];
    if (typeof raw === "string" && raw.trim().length > 0) {
      keys.add(raw.trim());
    }
  });
  return Array.from(keys);
};

export default function CartPageContent() {
  usePaymentCleanup();
  const { state, lines, savedLines, clear, addFixedLine, addPerUnitLine, syncLineConstraints } = useCart();
  const { user, status } = useAuth();
  const { openLogin } = useLoginDialog();
  const [upsellProducts, setUpsellProducts] = React.useState<UpsellProduct[]>([]);
  const [isUpsellLoading, setIsUpsellLoading] = React.useState(false);
  const carouselRef = React.useRef<HTMLDivElement | null>(null);
  const [, setCarouselControls] = React.useState({ canScrollPrev: false, canScrollNext: false });
  const cartVariantIds = React.useMemo(() => lines.map((line) => line.variantId), [lines]);
  const { availability } = useCartAvailability(cartVariantIds);
  const recentlyAddedTimer = React.useRef<number | null>(null);
  const [recentlyAddedId, setRecentlyAddedId] = React.useState<string | null>(null);
  const variantConstraintsCache = React.useRef<Map<string, VariantConstraint | null>>(new Map());
  const productConstraintsInFlight = React.useRef<Set<string>>(new Set());
  const loggedImpressionIds = React.useRef<Set<string>>(new Set());

  const updateCarouselControls = React.useCallback(() => {
    const container = carouselRef.current;
    if (!container) {
      setCarouselControls({ canScrollPrev: false, canScrollNext: false });
      return;
    }
    const { scrollLeft, scrollWidth, clientWidth } = container;
    const maxScrollLeft = Math.max(0, scrollWidth - clientWidth);
    const epsilon = 4;
    setCarouselControls({
      canScrollPrev: scrollLeft > epsilon,
      canScrollNext: scrollLeft < maxScrollLeft - epsilon,
    });
  }, []);

  const cartProductIdsKey = React.useMemo(
    () => Array.from(new Set(lines.map((line) => line.productId).filter(Boolean))).sort().join(','),
    [lines],
  );

  React.useEffect(() => {
    let active = true;
    setIsUpsellLoading(true);
    const cartParam = cartProductIdsKey ? `&cart=${encodeURIComponent(cartProductIdsKey)}` : "";
    fetch(`/api/cart/suggestions?limit=20${cartParam}`, { cache: "no-store" })
      .then((res) => {
        if (res.status === 401 || res.status === 403) {
          return null;
        }
        if (!res.ok) {
          throw new Error(`Failed to load cart suggestions: ${res.status}`);
        }
        return res.json();
      })
      .then((data: UpsellProductResponse | null) => {
        if (!active || !data) return;
        const items = Array.isArray(data?.products)
          ? data.products.filter(
            (product): product is UpsellProduct =>
              Boolean(product) && Boolean(product.line) && typeof product.line?.variantId === "string",
          )
          : [];
        setUpsellProducts(items);
        const freshImpressions = items.filter((item) => !loggedImpressionIds.current.has(item.id));
        freshImpressions.forEach((item) => loggedImpressionIds.current.add(item.id));
        void logCartRecommendationEvents(
          freshImpressions.map((item) => ({
            event: "impression" as const,
            algo: item.algo ?? "curated",
            productId: item.id,
          })),
          cartProductIdsKey,
        ).catch(() => undefined);
        requestAnimationFrame(() => updateCarouselControls());
      })
      .catch((error) => {
        if (active) {
          console.error("Failed to load cart suggestions", error);
          setUpsellProducts([]);
        }
      })
      .finally(() => {
        if (active) {
          setIsUpsellLoading(false);
          updateCarouselControls();
        }
      });

    return () => {
      active = false;
    };
  }, [cartProductIdsKey, updateCarouselControls]);

  React.useEffect(() => {
    const container = carouselRef.current;
    if (!container) {
      return;
    }
    const handleScroll = () => updateCarouselControls();
    container.addEventListener("scroll", handleScroll, { passive: true });

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => updateCarouselControls());
      resizeObserver.observe(container);
    }

    updateCarouselControls();

    return () => {
      container.removeEventListener("scroll", handleScroll);
      resizeObserver?.disconnect();
    };
  }, [updateCarouselControls, upsellProducts.length]);

  React.useEffect(
    () => () => {
      if (recentlyAddedTimer.current) {
        window.clearTimeout(recentlyAddedTimer.current);
      }
    },
    [],
  );

  React.useEffect(() => {
    if (!lines.length) {
      return;
    }

    const linesByProduct = new Map<string, CartLine[]>();

    lines.forEach((line) => {
      if (isPositiveNumber(line.minimumOrderQuantity) || isPositiveNumber(line.maximumOrderQuantity)) {
        return;
      }

      if (variantConstraintsCache.current.has(line.variantId)) {
        const cached = variantConstraintsCache.current.get(line.variantId);
        if (
          cached &&
          (isPositiveNumber(cached.minimumOrderQuantity) || isPositiveNumber(cached.maximumOrderQuantity))
        ) {
          syncLineConstraints(line.variantId, {
            minimumOrderQuantity: cached.minimumOrderQuantity,
            maximumOrderQuantity: cached.maximumOrderQuantity,
          });
        }
        return;
      }

      if (!line.productId) {
        variantConstraintsCache.current.set(line.variantId, null);
        return;
      }

      if (!linesByProduct.has(line.productId)) {
        linesByProduct.set(line.productId, []);
      }
      linesByProduct.get(line.productId)!.push(line);
    });

    if (!linesByProduct.size) {
      return;
    }

    const productIds = Array.from(linesByProduct.keys()).filter(
      (productId) => !productConstraintsInFlight.current.has(productId),
    );
    if (!productIds.length) {
      return;
    }

    let cancelled = false;
    productIds.forEach((productId) => productConstraintsInFlight.current.add(productId));

    const fetchConstraints = async (productId: string) => {
      try {
        const response = await fetch(`/api/catalog/products/${productId}`, { cache: "no-store" });
        if (!response.ok) {
          throw new Error(`Failed to load product ${productId}: ${response.status}`);
        }
        const payload = (await response.json()) as {
          product?: { variants?: Record<string, unknown>[] };
        };
        if (cancelled) {
          return;
        }
        const variants = Array.isArray(payload?.product?.variants) ? payload.product.variants : [];
        variants.forEach((variant) => {
          if (!variant || typeof variant !== "object") {
            return;
          }
          const variantRecord = variant as Record<string, unknown>;
          const keys = collectVariantIdentityKeys(variantRecord);
          if (!keys.length) {
            return;
          }
          const constraint: VariantConstraint = {
            minimumOrderQuantity: normalizeConstraintValue(variantRecord["minimumOrderQuantity"]),
            maximumOrderQuantity: normalizeConstraintValue(variantRecord["maximumOrderQuantity"]),
          };
          keys.forEach((key) => {
            variantConstraintsCache.current.set(key, constraint);
          });
        });

        const linesForProduct = linesByProduct.get(productId) ?? [];
        linesForProduct.forEach((line) => {
          const constraint = variantConstraintsCache.current.get(line.variantId);
          if (!constraint) {
            variantConstraintsCache.current.set(line.variantId, null);
            return;
          }
          if (
            isPositiveNumber(constraint.minimumOrderQuantity) ||
            isPositiveNumber(constraint.maximumOrderQuantity)
          ) {
            syncLineConstraints(line.variantId, constraint);
          }
        });
      } catch (error) {
        console.error(`Failed to sync order limits for product ${productId}`, error);
      } finally {
        productConstraintsInFlight.current.delete(productId);
      }
    };

    productIds.forEach((productId) => {
      void fetchConstraints(productId);
    });

    return () => {
      cancelled = true;
    };
  }, [lines, syncLineConstraints]);

  const handleUpsellClick = React.useCallback(
    (product: UpsellProduct) => {
      if (!product.inStock) {
        return;
      }
      const addUpsell = () => {
        if (product.line.priceModel === "per_unit") {
          addPerUnitLine(product.line, 1, product.line.unitOfMeasure);
        } else {
          addFixedLine(product.line, 1);
        }
        void logCartRecommendationEvents(
          [
            { event: "click", algo: product.algo ?? "curated", productId: product.id },
            { event: "add", algo: product.algo ?? "curated", productId: product.id },
          ],
          cartProductIdsKey,
        ).catch(() => undefined);
        setRecentlyAddedId(product.line.variantId);
        if (recentlyAddedTimer.current) {
          window.clearTimeout(recentlyAddedTimer.current);
        }
        recentlyAddedTimer.current = window.setTimeout(() => setRecentlyAddedId(null), 1500);
      };

      if (requiresCartLogin(status, Boolean(user))) {
        openLogin(addUpsell);
        return;
      }

      addUpsell();
    },
    [addFixedLine, addPerUnitLine, cartProductIdsKey, openLogin, status, user],
  );

  const scrollCarousel = React.useCallback((direction: number) => {
    const container = carouselRef.current;
    if (!container) return;
    const distance = container.clientWidth ? container.clientWidth * 0.9 : 240;
    container.scrollBy({ left: distance * direction, behavior: "smooth" });
  }, []);

  const steps = ["سبد خرید", "آدرس و ارسال", "پرداخت"];
  const [activeStep, setActiveStep] = React.useState(0);
  const [stepMessage, setStepMessage] = React.useState<string | null>(null);

  const hasAddressForCheckout = Boolean(
    state.address?.fname?.trim() &&
    state.address?.lname?.trim() &&
    state.address?.phone?.trim(),
  );

  const addressSummary = React.useMemo(
    () =>
      [state.address?.state, state.address?.city, state.address?.address]
        .filter((value): value is string => Boolean(value?.trim()))
        .join("، "),
    [state.address],
  );
  const shippingSummary = state.transportId
    ? state.shippingPaymentMethod === "on_delivery"
      ? "روش ارسال انتخاب شده؛ هزینهٔ ارسال هنگام تحویل پرداخت می‌شود."
      : "روش ارسال انتخاب شده؛ هزینهٔ ارسال در همین سایت پرداخت می‌شود."
    : "روش ارسال انتخاب نشده است.";

  React.useEffect(() => {
    const storedStep = Number(window.sessionStorage.getItem(CHECKOUT_STEP_STORAGE_KEY));
    if (storedStep >= 2 && lines.length > 0 && hasAddressForCheckout && state.transportId) {
      setActiveStep(2);
    } else if (storedStep >= 1 && lines.length > 0) {
      setActiveStep(1);
    }
  }, []);

  React.useEffect(() => {
    if (!lines.length) {
      window.sessionStorage.removeItem(CHECKOUT_STEP_STORAGE_KEY);
      if (activeStep !== 0) setActiveStep(0);
      return;
    }
    window.sessionStorage.setItem(CHECKOUT_STEP_STORAGE_KEY, String(activeStep));
  }, [activeStep, lines.length]);

  const handleNext = () => {
    if (!lines.length) {
      setStepMessage("برای ادامه، حداقل یک کالا در سبد لازم است.");
      return;
    }
    if (activeStep === 1 && !hasAddressForCheckout) {
      setStepMessage("لطفاً نام، نام خانوادگی و شماره تماس گیرنده را کامل کنید.");
      return;
    }
    if (activeStep === 1 && !state.transportId) {
      setStepMessage("لطفاً روش ارسال را انتخاب کنید.");
      return;
    }
    setStepMessage(null);
    setActiveStep((s) => Math.min(s + 1, steps.length - 1));
  };
  const handleBack = () => {
    setStepMessage(null);
    setActiveStep((s) => Math.max(s - 1, 0));
  };

  const showCart = activeStep === 0;
  const showAddress = activeStep === 1;
  const showPayment = activeStep === 2;

  const renderStepper = (
    <Stack direction="row" gap={1.25} alignItems="center" sx={{ flex: "1 1 auto" }}>
      {activeStep !== 0 && (
        <Button
          sx={{
            flex: "1 1 auto",
            minHeight: 46,
            borderRadius: `${TEB_RADII.pill}px`,
            fontWeight: 700,
          }}
          variant="outlined"
          onClick={handleBack}
        >
          مرحله قبل
        </Button>
      )}
      {activeStep < steps.length - 1 && (
        <Button
          sx={{
            flex: "1 1 auto",
            minHeight: 46,
            borderRadius: `${TEB_RADII.pill}px`,
            fontWeight: 700,
            bgcolor: TEB_COLORS.primary,
            "&:hover": { bgcolor: TEB_COLORS.primaryDark },
          }}
          variant="contained"
          disabled={lines.length === 0}
          onClick={handleNext}
        >
          {activeStep === 0 ? "ادامه و ثبت آدرس" : "ادامه و پرداخت"}
        </Button>
      )}
    </Stack>
  );

  return (
    <Container maxWidth="lg">
      <Box sx={{ position: "relative", py: { xs: 3, md: 5 } }}>
        {/* Header */}
        <Stack spacing={0.75} sx={{ mb: 3 }}>
          <Typography variant="h4" component="h1" fontWeight={800} color={TEB_COLORS.textPrimary}>
            سبد خرید
          </Typography>
          <Typography variant="body2" color="text.secondary">
            اقلام انتخابی خود را بررسی کنید و سپس آدرس تحویل و روش ارسال را انتخاب نمایید.
          </Typography>
        </Stack>

        {/* Stepper */}
        <Paper
          elevation={0}
          sx={{
            mb: 3,
            px: { xs: 2, md: 3 },
            py: { xs: 1.75, md: 2.25 },
            borderRadius: `${TEB_RADII.lg}px`,
            border: `1px solid ${TEB_COLORS.border}`,
            bgcolor: "#FFFFFF",
          }}
        >
          <Stepper alternativeLabel activeStep={activeStep}>
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>
                  <Tooltip title={label}>
                    <span>{label}</span>
                  </Tooltip>
                </StepLabel>
              </Step>
            ))}
          </Stepper>
        </Paper>
        {stepMessage ? (
          <Paper
            elevation={0}
            sx={{
              mb: 2,
              px: 2,
              py: 1.25,
              borderRadius: `${TEB_RADII.md}px`,
              border: `1px solid ${TEB_COLORS.warning}`,
              bgcolor: TEB_COLORS.surfaceSoft,
              color: TEB_COLORS.textPrimary,
            }}
          >
            <Typography variant="body2" fontWeight={700}>
              {stepMessage}
            </Typography>
          </Paper>
        ) : null}

        {/* Main Content */}
        <Grid container spacing={2.5}>
          {showCart && (
            <Grid size={{ xs: 12, md: 8 }}>
              <Stack spacing={2.5}>
                <Paper
                  elevation={0}
                  sx={{
                    p: { xs: 2, md: 2.75 },
                    borderRadius: `${TEB_RADII.lg}px`,
                    border: `1px solid ${TEB_COLORS.border}`,
                    bgcolor: "#FFFFFF",
                  }}
                >
                  <Stack spacing={2}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between">
                      <Stack direction="row" spacing={1.25} alignItems="center">
                        <ShoppingBag size={20} color={TEB_COLORS.primary} />
                        <Typography variant="subtitle1" fontWeight={800} color={TEB_COLORS.textPrimary}>
                          اقلام سبد خرید
                        </Typography>
                        {!!lines.length && (
                          <Chip
                            label={`${lines.length.toLocaleString("fa-IR")} مورد`}
                            size="small"
                            sx={{
                              borderRadius: `${TEB_RADII.pill}px`,
                              bgcolor: TEB_COLORS.surfaceSoft,
                              color: TEB_COLORS.primary,
                              fontWeight: 700,
                            }}
                          />
                        )}
                      </Stack>
                      {!!lines.length && (
                        <Tooltip title="خالی کردن سبد">
                          <span>
                            <IconButton
                              size="small"
                              color="error"
                              aria-label="خالی کردن سبد"
                              onClick={() => clear()}
                              sx={{ width: 40, height: 40 }}
                            >
                              <Trash2 size={18} />
                            </IconButton>
                          </span>
                        </Tooltip>
                      )}
                    </Stack>

                    <Divider sx={{ borderColor: TEB_COLORS.border }} />

                    {lines.length === 0 ? (
                      <>
                        <EmptyState
                          title="سبد خرید شما خالی است"
                          description="گیاهان دارویی، دمنوش‌ها و روغن‌های طبیعی طب احمدی را ببینید و محصولات مورد نیاز خود را اضافه کنید."
                          actionLabel="مشاهده فروشگاه"
                          actionHref="/store"
                        />
                        {savedLines.length > 0 ? <SavedCartLines /> : null}
                      </>
                    ) : (
                      <Stack spacing={1.5}>
                        {lines.map((line: CartLine) => (
                          <CartLineItem key={line.variantId} line={line} availability={availability.get(line.variantId)} />
                        ))}
                        <SavedCartLines />
                      </Stack>
                    )}
                  </Stack>
                </Paper>

                {(isUpsellLoading || upsellProducts.length > 0) && (
                  <Paper
                    elevation={0}
                    sx={{
                      p: { xs: 2, md: 2.75 },
                      borderRadius: `${TEB_RADII.lg}px`,
                      border: `1px solid ${TEB_COLORS.border}`,
                      bgcolor: "#FFFFFF",
                    }}
                  >
                    <Stack spacing={2}>
                      <Stack direction="row" alignItems="center" justifyContent="space-between">
                        <Typography variant="subtitle1" fontWeight={800} color={TEB_COLORS.textPrimary}>
                          پیشنهادهای مکمل برای سبد شما
                        </Typography>
                        <Stack direction="row" spacing={0.5}>
                          <IconButton
                            size="small"
                            onClick={() => scrollCarousel(-1)}
                            aria-label="اسکرول به عقب"
                            sx={{ border: `1px solid ${TEB_COLORS.border}`, width: 36, height: 36 }}
                          >
                            <ChevronRight size={18} />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => scrollCarousel(1)}
                            aria-label="اسکرول به جلو"
                            sx={{ border: `1px solid ${TEB_COLORS.border}`, width: 36, height: 36 }}
                          >
                            <ChevronLeft size={18} />
                          </IconButton>
                        </Stack>
                      </Stack>
                      <Box sx={{ position: "relative" }}>
                        <Box
                          ref={carouselRef}
                          sx={{
                            display: "flex",
                            gap: 1.5,
                            overflowX: "auto",
                            scrollSnapType: "x mandatory",
                            scrollBehavior: "smooth",
                            direction: "ltr",
                            px: 0.5,
                            py: 0.5,
                            "&::-webkit-scrollbar": { display: "none" },
                            scrollbarWidth: "none",
                          }}
                        >
                          {isUpsellLoading && upsellProducts.length === 0 ? (
                            <>
                              {[...Array(4)].map((_, index) => (
                                <Skeleton
                                  key={`upsell-skeleton-${index}`}
                                  variant="rounded"
                                  width={180}
                                  height={230}
                                  sx={{ flex: "0 0 auto", borderRadius: `${TEB_RADII.md}px` }}
                                />
                              ))}
                            </>
                          ) : (
                            upsellProducts.map((product) => {
                              const isRecentlyAdded = recentlyAddedId === product.line.variantId;
                              return (
                                <ButtonBase
                                  key={product.line.variantId}
                                  focusRipple
                                  disabled={!product.inStock}
                                  onClick={() => handleUpsellClick(product)}
                                  sx={{
                                    flex: "0 0 auto",
                                    width: 184,
                                    borderRadius: `${TEB_RADII.md}px`,
                                    overflow: "hidden",
                                    display: "flex",
                                    flexDirection: "column",
                                    alignItems: "stretch",
                                    border: "1px solid",
                                    borderColor: isRecentlyAdded ? TEB_COLORS.primary : TEB_COLORS.border,
                                    bgcolor: "#FFFFFF",
                                    p: 0,
                                    textAlign: "right",
                                    direction: "rtl",
                                    position: "relative",
                                    transition: "transform 0.2s ease, border-color 0.2s ease",
                                    "&:hover": product.inStock
                                      ? {
                                        transform: "translateY(-2px)",
                                        borderColor: TEB_COLORS.primary,
                                      }
                                      : undefined,
                                    "&.Mui-disabled": {
                                      opacity: 0.7,
                                      bgcolor: TEB_COLORS.surfaceSoft,
                                    },
                                    scrollSnapAlign: "start",
                                  }}
                                >
                                  {isRecentlyAdded && (
                                    <Chip
                                      label="افزوده شد"
                                      size="small"
                                      sx={{
                                        position: "absolute",
                                        top: 8,
                                        left: 8,
                                        zIndex: 1,
                                        bgcolor: TEB_COLORS.primary,
                                        color: "#FFFFFF",
                                        fontWeight: 700,
                                      }}
                                    />
                                  )}
                                  <Box
                                    sx={{
                                      position: "relative",
                                      width: "100%",
                                      aspectRatio: "1 / 1",
                                      overflow: "hidden",
                                      bgcolor: TEB_COLORS.surfaceSoft,
                                    }}
                                  >
                                    <Box
                                      component="img"
                                      alt={product.title}
                                      src={product.imageUrl ?? UPSELL_FALLBACK_IMAGE}
                                      style={{
                                        objectFit: "cover",
                                        filter: product.inStock ? "none" : "grayscale(100%)",
                                        position: "absolute",
                                        inset: 0,
                                        width: "100%",
                                        height: "100%",
                                      }}
                                    />
                                    {!product.inStock && (
                                      <Box
                                        sx={{
                                          position: "absolute",
                                          inset: 0,
                                          bgcolor: "rgba(34, 34, 34, 0.4)",
                                          display: "flex",
                                          alignItems: "center",
                                          justifyContent: "center",
                                        }}
                                      >
                                        <Typography variant="caption" color="#FFFFFF" fontWeight={700}>
                                          ناموجود
                                        </Typography>
                                      </Box>
                                    )}
                                  </Box>
                                  <Stack spacing={0.6} sx={{ p: 1.5, width: "100%" }}>
                                    <Typography variant="body2" fontWeight={700} color={TEB_COLORS.textPrimary} noWrap>
                                      {product.title}
                                    </Typography>
                                    <Stack direction="row" spacing={1} alignItems="baseline">
                                      {typeof product.originalPrice === "number" && product.originalPrice > product.finalPrice && (
                                        <Typography
                                          variant="caption"
                                          color="text.secondary"
                                          sx={{ textDecoration: "line-through", fontVariantNumeric: "tabular-nums" }}
                                        >
                                          {formatPrice(product.originalPrice)}
                                        </Typography>
                                      )}
                                      <Typography
                                        variant="subtitle2"
                                        fontWeight={800}
                                        color={TEB_COLORS.primaryDark}
                                        sx={{ fontVariantNumeric: "tabular-nums" }}
                                      >
                                        {formatPrice(product.finalPrice)}
                                      </Typography>
                                    </Stack>
                                    {typeof product.discountPercent === "number" && product.discountPercent > 0 ? (
                                      <Typography variant="caption" fontWeight={700} color={TEB_COLORS.error}>
                                        {product.discountPercent.toLocaleString("fa-IR")}٪ تخفیف
                                      </Typography>
                                    ) : null}
                                    <Typography
                                      variant="caption"
                                      fontWeight={700}
                                      color={product.inStock ? TEB_COLORS.primary : "text.secondary"}
                                    >
                                      {product.inStock ? "افزودن سریع به سبد" : "ناموجود"}
                                    </Typography>
                                  </Stack>
                                </ButtonBase>
                              );
                            })
                          )}
                        </Box>
                      </Box>
                    </Stack>
                  </Paper>
                )}
              </Stack>
            </Grid>
          )}

          {showAddress && (
            <Grid size={{ xs: 12, md: 8 }}>
              <Paper
                elevation={0}
                sx={{
                  p: { xs: 2, md: 3 },
                  borderRadius: `${TEB_RADII.lg}px`,
                  border: `1px solid ${TEB_COLORS.border}`,
                  bgcolor: "#FFFFFF",
                }}
              >
                <Stack spacing={2.5}>
                  <Stack spacing={0.5}>
                    <Typography variant="subtitle1" fontWeight={800} color={TEB_COLORS.textPrimary}>
                      اطلاعات گیرنده و آدرس تحویل
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      تکمیل نام، نام خانوادگی، شماره تماس و انتخاب استان و شهر برای محاسبه ارسال الزامی است.
                    </Typography>
                  </Stack>
                  <AddressForm />
                  <Divider sx={{ borderColor: TEB_COLORS.border }} />
                  <Stack spacing={1.25}>
                    <Typography variant="subtitle1" fontWeight={800} color={TEB_COLORS.textPrimary}>
                      روش ارسال
                    </Typography>
                    <CarrierSelect />
                  </Stack>
                </Stack>
              </Paper>
            </Grid>
          )}

          {showPayment && (
            <>
              <CartPaymentContext
                addressSummary={addressSummary}
                shippingSummary={shippingSummary}
                onEditShipping={() => {
                  setStepMessage(null);
                  setActiveStep(1);
                }}
              />
              <Grid size={{ xs: 12, md: 8 }}>
              <Paper
                elevation={0}
                sx={{
                  p: { xs: 1, md: 1.5 },
                  borderRadius: `${TEB_RADII.lg}px`,
                  border: `1px solid ${TEB_COLORS.border}`,
                  bgcolor: "#FFFFFF",
                }}
              >
                <Stack spacing={1}>
                  <Stack sx={{ px: 1.5, pt: 1 }} spacing={0.5}>
                    <Typography variant="h6" fontWeight={800} color={TEB_COLORS.textPrimary}>
                      پرداخت سفارش
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      مبلغ نهایی و درگاه پرداخت موردنظر را بررسی و انتخاب کنید.
                    </Typography>
                  </Stack>
                  <CartSummary show action={renderStepper} />
                </Stack>
              </Paper>
              </Grid>
            </>
          )}

          {/* Summary Sidebar */}
          {!showPayment && <Grid size={{ xs: 12, md: 4 }}>
            <Box sx={{ position: { md: "sticky" }, top: { md: 108 }, zIndex: 1 }}>
              <Paper
                elevation={0}
                sx={{
                  p: { xs: 1.5, md: 2 },
                  borderRadius: `${TEB_RADII.lg}px`,
                  border: `1px solid ${TEB_COLORS.border}`,
                  bgcolor: "#FFFFFF",
                }}
              >
                {activeStep === 1 && (
                  <Stack spacing={1.25} sx={{ px: 1.5, pt: 1.5 }}>
                    <Typography variant="subtitle2" fontWeight={800} color={TEB_COLORS.textPrimary}>
                      کد تخفیف
                    </Typography>
                    <OfferInput />
                    <Divider sx={{ pt: 1, borderColor: TEB_COLORS.border }} />
                  </Stack>
                )}
                <CartSummary show={false} action={renderStepper} />
                {lines.length > 0 && (
                  <Box sx={{ px: 2, pb: 1.5 }}>
                    <Button
                      component={Link}
                      href="/store"
                      variant="text"
                      size="small"
                      fullWidth
                      sx={{ color: TEB_COLORS.primary, fontWeight: 600 }}
                    >
                      ادامه خرید در فروشگاه
                    </Button>
                  </Box>
                )}
              </Paper>
            </Box>
          </Grid>}
        </Grid>
      </Box>
    </Container>
  );
}
