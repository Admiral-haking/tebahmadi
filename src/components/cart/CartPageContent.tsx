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
import ShoppingBagRoundedIcon from "@mui/icons-material/ShoppingBagRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import ChevronLeftRoundedIcon from "@mui/icons-material/ChevronLeftRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import Image from "next/image";

import { useCart, type CartLine } from "./useCart";
import CartLineItem from "./CartLineItem";
import OfferInput from "./OfferInput";
import CarrierSelect from "./CarrierSelect";
import AddressForm from "./AddressForm";
import CartSummary from "./CartSummary";
import { usePaymentCleanup } from "./usePaymentCleanup";

type UpsellProduct = {
  id: string;
  slug: string;
  title: string;
  finalPrice: number;
  originalPrice?: number;
  discountPercent?: number;
  inStock: boolean;
  imageUrl?: string;
  line: CartLine;
};

type UpsellProductResponse = {
  products: UpsellProduct[];
};

const UPSELL_FALLBACK_IMAGE = "/sample.jpg";
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

// -----------------------------------------
// Page Component (neutral layout-only updates)
// -----------------------------------------
export default function CartPageContent() {
  usePaymentCleanup();
  const { lines, clear, addFixedLine, addPerUnitLine, syncLineConstraints } = useCart();
  const [upsellProducts, setUpsellProducts] = React.useState<UpsellProduct[]>([]);
  const [isUpsellLoading, setIsUpsellLoading] = React.useState(false);
  const carouselRef = React.useRef<HTMLDivElement | null>(null);
  const [carouselControls, setCarouselControls] = React.useState({ canScrollPrev: false, canScrollNext: false });
  const recentlyAddedTimer = React.useRef<number | null>(null);
  const [recentlyAddedId, setRecentlyAddedId] = React.useState<string | null>(null);
  const variantConstraintsCache = React.useRef<Map<string, VariantConstraint | null>>(new Map());
  const productConstraintsInFlight = React.useRef<Set<string>>(new Set());

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

  React.useEffect(() => {
    let active = true;
    setIsUpsellLoading(true);
    fetch("/api/cart/suggestions?limit=20", { cache: "no-store" })
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Failed to load cart suggestions: ${res.status}`);
        }
        return res.json();
      })
      .then((data: UpsellProductResponse) => {
        if (!active) return;
        const items = Array.isArray(data?.products)
          ? data.products.filter(
            (product): product is UpsellProduct =>
              Boolean(product) && Boolean(product.line) && typeof product.line?.variantId === "string",
          )
          : [];
        setUpsellProducts(items);
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
  }, [updateCarouselControls]);

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
      if (product.line.priceModel === "per_unit") {
        addPerUnitLine(product.line, 1, product.line.unitOfMeasure);
      } else {
        addFixedLine(product.line, 1);
      }
      setRecentlyAddedId(product.line.variantId);
      if (recentlyAddedTimer.current) {
        window.clearTimeout(recentlyAddedTimer.current);
      }
      recentlyAddedTimer.current = window.setTimeout(() => setRecentlyAddedId(null), 1500);
    },
    [addFixedLine, addPerUnitLine],
  );

  const scrollCarousel = React.useCallback((direction: number) => {
    const container = carouselRef.current;
    if (!container) return;
    const distance = container.clientWidth ? container.clientWidth * 0.9 : 240;
    container.scrollBy({ left: distance * direction, behavior: "smooth" });
  }, []);

  // Steps: 0 Cart, 1 Address + Shipping
  const steps = ["سبد خرید", "آدرس تحویل"];
  const [activeStep, setActiveStep] = React.useState(lines.length ? 0 : 0);

  const handleNext = () => setActiveStep((s) => Math.min(s + 1, steps.length - 1));
  const handleBack = () => setActiveStep((s) => Math.max(s - 1, 0));

  // Progressive visibility helpers
  const showCart = activeStep === 0;
  const showAddress = activeStep === 1;


  const renderStepper = <Stack direction="row" gap={1} alignItems="center" sx={{ flex: '1 1 auto' }}>
    {activeStep !== 0 && <Button sx={{ flex: '1 1 auto' }} variant="outlined" onClick={handleBack}>
      مرحله قبل
    </Button>}
    {activeStep !== 1 && <Button sx={{ flex: '1 1 auto' }} variant="contained" onClick={handleNext}>
      مرحله بعد
    </Button>}
  </Stack>;

  return (
    <>

      <Container maxWidth="lg" sx={{ px: { xs: 1.5, sm: 2 } }}>

        <Box sx={{ position: "relative", py: { xs: 3, md: 5 } }}>
          {/* Header */}
          <Stack spacing={1} sx={{ mb: 2 }}>
            <Typography variant="h4" fontWeight={800}>
              سبد خرید
            </Typography>
            <Typography variant="body2" color="text.secondary">
              هر مرحله را کامل کنید و روی «مرحله بعد» بزنید.
            </Typography>
          </Stack>

          {/* Stepper (default styling; no custom colors) */}
          <Paper elevation={0} sx={{ mb: 3, px: { xs: 1.5, md: 3 }, py: { xs: 1.5, md: 2 }, borderRadius: 4, border: 1, borderColor: "divider" }}>
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

          {/* Main Content */}
          <Grid container spacing={{ xs: 2, md: 3 }} alignItems="flex-start">
            {showCart && (
              <Grid size={{ xs: 12, md: 8 }}>
                <Stack spacing={2}>
                  <Paper elevation={0} sx={{ p: { xs: 1.5, md: 2.5 }, borderRadius: 4, border: 1, borderColor: "divider" }}>
                    <Stack spacing={2}>
                      <Stack direction="row" alignItems="center" justifyContent="space-between">
                        <Stack direction="row" spacing={1.2} alignItems="center">
                          <ShoppingBagRoundedIcon fontSize="small" />
                          <Typography variant="subtitle1" fontWeight={700}>
                            اقلام سبد
                          </Typography>
                          {!!lines.length && (
                            <Chip label={`${lines.length} مورد`} size="small" sx={{ borderRadius: 1.5 }} />
                          )}
                        </Stack>
                        {!!lines.length && (
                          <Tooltip title="خالی کردن سبد">
                            <span>
                              <IconButton size="small" color="error" onClick={() => clear()}>
                                <DeleteOutlineRoundedIcon />
                              </IconButton>
                            </span>
                          </Tooltip>
                        )}
                      </Stack>

                      <Divider variant="fullWidth" sx={{ borderStyle: "dashed" }} />

                      {lines.length === 0 ? (
                        <Box sx={{ p: { xs: 3, md: 4 }, border: "1px dashed", borderColor: "divider", borderRadius: 2, textAlign: "center" }}>
                          <Typography variant="subtitle1" color="text.secondary" sx={{ mb: 1 }}>
                            سبد خرید شما خالی است.
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            محصولات مورد نظر خود را به سبد اضافه کنید.
                          </Typography>
                        </Box>
                      ) : (
                        <Stack spacing={1.5}>
                          {lines.map((line: any) => (
                            <CartLineItem key={line.variantId} line={line} />
                          ))}
                        </Stack>
                      )}
                    </Stack>
                  </Paper>
                  {(isUpsellLoading || upsellProducts.length > 0) && (
                    <Paper elevation={0} sx={{ p: { xs: 1.5, md: 2.5 }, borderRadius: 4, border: 1, borderColor: "divider" }}>
                      <Stack spacing={2}>
                        <Stack direction="row" alignItems="center" justifyContent="space-between">
                          <Typography variant="subtitle1" fontWeight={700}>
                            پیشنهادهای ویژه برای شما
                          </Typography>
                          <Stack direction="row" spacing={0.5}>
                            <IconButton
                              size="small"
                              onClick={() => scrollCarousel(-1)}
                              aria-label="اسکرول به عقب"
                            >
                              <ChevronRightRoundedIcon fontSize="small" />
                            </IconButton>
                            <IconButton
                              size="small"
                              onClick={() => scrollCarousel(1)}
                              aria-label="اسکرول به جلو"
                            >
                              <ChevronLeftRoundedIcon fontSize="small" />
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
                                    height={220}
                                    sx={{ flex: "0 0 auto", borderRadius: 2 }}
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
                                      width: 180,
                                      borderRadius: 2,
                                      overflow: "hidden",
                                      display: "flex",
                                      flexDirection: "column",
                                      alignItems: "stretch",
                                      border: "1px solid",
                                      borderColor: isRecentlyAdded ? "primary.main" : "divider",
                                      bgcolor: "background.paper",
                                      p: 0,
                                      textAlign: "right",
                                      direction: "rtl",
                                      position: "relative",
                                      transition: "transform 0.2s ease, box-shadow 0.2s ease",
                                      "&:hover": product.inStock
                                        ? {
                                          transform: "translateY(-4px)",
                                          boxShadow: 3,
                                        }
                                        : undefined,
                                      "&.Mui-disabled": {
                                        opacity: 1,
                                        bgcolor: "action.disabledBackground",
                                      },
                                      scrollSnapAlign: "start",
                                    }}
                                  >
                                    {isRecentlyAdded && (
                                      <Chip
                                        label="افزوده شد"
                                        color="primary"
                                        size="small"
                                        sx={{ position: "absolute", top: 8, left: 8, zIndex: 1 }}
                                      />
                                    )}
                                    <Box
                                      sx={{
                                        position: "relative",
                                        width: "100%",
                                        aspectRatio: "1 / 1",
                                        overflow: "hidden",
                                      }}
                                    >
                                      <Box
                                        component="img"
                                        alt={product.title}
                                        src={product.imageUrl ?? UPSELL_FALLBACK_IMAGE}
                                        style={{
                                          objectFit: "cover",
                                          filter: product.inStock ? "none" : "grayscale(100%)",
                                          transform: product.inStock ? "none" : "scale(1.05)",
                                          transition: "transform 0.3s ease",
                                          position: 'absolute',
                                          left: 0,
                                          top: 0,
                                          right: 0,
                                          bottom: 0,
                                          width: '100%',
                                          height: '100%'
                                        }}
                                      />
                                      {!product.inStock && (
                                        <Box
                                          sx={{
                                            position: "absolute",
                                            inset: 0,
                                            bgcolor: "rgba(var(--mui-palette-common-onBackgroundChannel) / 0.35)",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                          }}
                                        >
                                          <Typography variant="caption" color="common.white">
                                            ناموجود
                                          </Typography>
                                        </Box>
                                      )}
                                    </Box>
                                    <Stack spacing={0.75} sx={{ p: 1.5, width: "100%" }}>
                                      <Typography variant="body2" color="text.primary" noWrap>
                                        {product.title}
                                      </Typography>
                                      <Stack direction="row" spacing={1} alignItems="baseline">
                                        {typeof product.originalPrice === "number" && product.originalPrice > product.finalPrice && (
                                          <Typography
                                            variant="caption"
                                            color="text.secondary"
                                            sx={{ textDecoration: "line-through" }}
                                          >
                                            {formatPrice(product.originalPrice)}
                                          </Typography>
                                        )}
                                        <Typography variant="subtitle2" color="text.primary">
                                          {formatPrice(product.finalPrice)}
                                        </Typography>
                                      </Stack>
                                      {typeof product.discountPercent === "number" && product.discountPercent > 0 ? (
                                        <Typography variant="caption" color="success.main">
                                          {product.discountPercent}% تخفیف
                                        </Typography>
                                      ) : null}
                                      {product.inStock ? (
                                        <Typography variant="caption" color="primary.main">
                                          برای افزودن به سبد کلیک کنید
                                        </Typography>
                                      ) : (
                                        <Typography variant="caption" color="text.secondary">
                                          محصول ناموجود است
                                        </Typography>
                                      )}
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

            {/* Middle: Progressive Details (Address + Shipping) */}
            {
              showAddress && <Grid size={{ xs: 12, md: 8 }}>
                <Paper elevation={0} sx={{ p: { xs: 2, md: 2.5 }, borderRadius: 4, border: 1, borderColor: "divider" }}>
                  <Stack spacing={2}>
                    <Typography variant="subtitle1" fontWeight={700}>آدرس تحویل</Typography>
                    <AddressForm />
                    <Divider variant="fullWidth" sx={{ borderStyle: "dashed" }} />
                    <Stack spacing={1}>
                      <Typography variant="subtitle1" fontWeight={700}>روش ارسال</Typography>
                      <CarrierSelect />
                    </Stack>
                  </Stack>
                </Paper>
              </Grid>
            }
            {/* Right: Summary (unchanged behavior; sticky) */}
            <Grid size={{ xs: 12, md: 4 }}>
              <Box sx={{ position: { md: "sticky" }, top: { md: 88 }, zIndex: 1 }}>

                <Paper elevation={0} sx={{ p: { xs: 2, md: 2.5 }, borderRadius: 4, border: 1, borderColor: "divider", position: { md: 'sticky' }, top: { md: 110 } }}>
                  {
                    activeStep === 1 && <Stack spacing={1}>
                      <Typography variant="subtitle1" fontWeight={700}>کد تخفیف</Typography>
                      <OfferInput />
                    </Stack>
                  }
                  <CartSummary show={activeStep === 1} action={renderStepper} />
                </Paper>
              </Box>
            </Grid>
          </Grid>
          {/* Navigation */}
        </Box>
      </Container>
    </>
  );
}
