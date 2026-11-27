"use client";

import { Box, ButtonBase, Chip, Stack, Typography } from "@mui/material";
import OptimizedImage from "@/components/image";
import { TEB_COLORS, TEB_RADII } from "@/theme/tokens";
import type { CartLine } from "./useCart";

const FALLBACK_IMAGE = "/product-placeholder.svg";
const PRICE_FORMATTER = new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 0 });

const formatPrice = (value: number) => `${PRICE_FORMATTER.format(Math.max(0, Math.floor(value)))} تومان`;

export type CartUpsellProduct = {
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

export default function CartUpsellCard({
  product,
  isRecentlyAdded,
  onAdd,
}: {
  product: CartUpsellProduct;
  isRecentlyAdded: boolean;
  onAdd: () => void;
}) {
  return (
    <ButtonBase
      focusRipple
      disabled={!product.inStock}
      onClick={onAdd}
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
        <OptimizedImage
          alt={product.title}
          src={product.imageUrl ?? FALLBACK_IMAGE}
          fallbackSrc={FALLBACK_IMAGE}
          fill
          loading="lazy"
          sizes="184px"
          style={{
            objectFit: "cover",
            filter: product.inStock ? "none" : "grayscale(100%)",
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
}
