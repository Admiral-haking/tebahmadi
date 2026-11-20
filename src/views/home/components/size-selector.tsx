"use client";

import Link from "next/link";
import {
  Box,
  Button,
  ButtonBase,
  Container,
  Stack,
  Typography,
} from "@mui/material";

const SIZES = Array.from({ length: 31 }, (_, index) => String(index + 18));
const SIZE_GROUPS = [
  { label: "کودک", sizes: SIZES.filter((size) => Number(size) <= 24) },
  {
    label: "نوجوان",
    sizes: SIZES.filter((size) => Number(size) >= 25 && Number(size) <= 34),
  },
  { label: "بزرگسال", sizes: SIZES.filter((size) => Number(size) >= 35) },
];
type PaletteColorKey = "primary" | "secondary" | "info" | "success" | "warning" | "error";
const SIZE_COLORS: PaletteColorKey[] = ["info", "success", "warning", "error", "secondary"];

type SizeSelectorProps = {
  categoryId?: string;
  storePath?: string;
};

const DEFAULT_SHOES_STORE_PATH = "shoes";

function buildStoreHref(storePath: string | undefined, size: string): string {
  const params = new URLSearchParams();
  params.set("attr.size", size);
  const resolvedStorePath = storePath?.trim() || DEFAULT_SHOES_STORE_PATH;
  return `/store/${resolvedStorePath}?${params.toString()}`;
}

export default function SizeSelector({ storePath }: SizeSelectorProps) {
  const panelBackground =
    "linear-gradient(135deg, rgba(var(--mui-palette-background-paperChannel) / 0.98) 0%, rgba(var(--mui-palette-success-mainChannel) / 0.1) 100%)";
  const headingColor = "var(--mui-palette-text-primary)";
  const bodyColor = "var(--mui-palette-text-secondary)";
  const labelColor = "var(--mui-palette-text-secondary)";

  return (
    <Container
      maxWidth="md"
      sx={{
        px: { xs: 1.5, sm: 2 },
        mt: { xs: 2.5, md: 3 },
        mb: { xs: 3, md: 4 },
      }}
    >
      <Box
        sx={{
          position: "relative",
          overflow: "hidden",
          borderRadius: 2,
          border: "1px solid rgba(var(--mui-palette-success-mainChannel) / 0.22)",
          background: panelBackground,
          backdropFilter: "blur(20px)",
          boxShadow:
            "0 12px 30px rgba(var(--mui-palette-text-primaryChannel) / 0.08), inset 0 1px 0 rgba(var(--mui-palette-common-backgroundChannel) / 0.18)",
          p: { xs: 1.15, sm: 1.75 },
          "&:before": {
            content: '""',
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(90deg, rgba(var(--mui-palette-success-mainChannel) / 0.12), transparent 45%, rgba(var(--mui-palette-success-mainChannel) / 0.12))",
            pointerEvents: "none",
          },
        }}
      >
        <Stack spacing={1.4} sx={{ position: "relative", zIndex: 1 }}>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            alignItems={{ xs: "stretch", sm: "center" }}
            justifyContent="space-between"
            gap={1}
          >
            <Box>
              <Typography
                variant="h6"
                sx={{
                  color: headingColor,
                  fontWeight: 900,
                  fontSize: { xs: "1rem", md: "1.1rem" },
                  textShadow: "0 1px 12px rgba(var(--mui-palette-info-mainChannel) / 0.35)",
                }}
              >
                خرید بر اساس سایز
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  color: bodyColor,
                  fontSize: { xs: 12.5, md: 13.5 },
                }}
              >
                سایز مناسب را انتخاب کنید تا فقط مدل‌های قابل سفارش همان سایز نمایش داده شوند.
              </Typography>
            </Box>
          </Stack>

          <Stack spacing={1.05}>
            {SIZE_GROUPS.map((group, groupIndex) => (
              <Stack
                key={group.label}
                direction="row"
                alignItems={{ xs: "stretch", sm: "center" }}
                gap={1}
                sx={{
                  minWidth: 0,
                  flexDirection: { xs: "column", sm: "row" },
                  p: { xs: 0.8, sm: 0 },
                  borderRadius: { xs: 1.5, sm: 0 },
                  bgcolor: { xs: "rgba(var(--mui-palette-background-paperChannel) / 0.56)", sm: "transparent" },
                  border: { xs: "1px solid", sm: "0" },
                  borderColor: { xs: "var(--mui-palette-divider)", sm: "transparent" },
                }}
              >
                <Typography
                  variant="caption"
                  sx={{
                    flex: { xs: "unset", sm: "0 0 52px" },
                    color: labelColor,
                    fontWeight: 800,
                  }}
                >
                  {group.label}
                </Typography>
                <Box
                  sx={{
                    display: { xs: "grid", sm: "flex" },
                    gridTemplateColumns: {
                      xs: "repeat(auto-fit, minmax(38px, 1fr))",
                      sm: "none",
                    },
                    gap: { xs: 0.75, sm: 0.85 },
                    overflowX: "visible",
                    flexWrap: { sm: "wrap" },
                    width: "100%",
                  }}
                >
                  {group.sizes.map((size, index) => {
                    const colorKey =
                      SIZE_COLORS[(index + groupIndex) % SIZE_COLORS.length];
                    return (
                      <ButtonBase
                        key={size}
                        component={Link}
                        href={buildStoreHref(storePath, size)}
                        aria-label={`نمایش محصولات با ویژگی سایز ${size}`}
                        sx={{
                          width: "100%",
                          minWidth: { xs: 0, sm: 40 },
                          maxWidth: { xs: "none", sm: 40 },
                          height: { xs: 38, sm: 40 },
                          flex: { xs: "unset", sm: "0 0 auto" },
                          borderRadius: { xs: 1.5, sm: "50%" },
                          border: "1px solid",
                          borderColor: `var(--mui-palette-${colorKey}-main)`,
                          bgcolor: `rgba(var(--mui-palette-${colorKey}-mainChannel) / 0.08)`,
                          color: `var(--mui-palette-${colorKey}-dark)`,
                          fontWeight: 900,
                          fontSize: 13,
                          textDecoration: "none",
                          boxShadow: "0 5px 14px rgba(var(--mui-palette-text-primaryChannel) / 0.14)",
                          transition:
                            "transform 150ms ease, box-shadow 150ms ease",
                          "&:hover": {
                            transform: "translateY(-1px)",
                            boxShadow: `0 0 0 3px rgba(var(--mui-palette-${colorKey}-mainChannel) / 0.19), 0 9px 18px rgba(var(--mui-palette-text-primaryChannel) / 0.2)`,
                          },
                        }}
                      >
                        {size}
                      </ButtonBase>
                    );
                  })}
                </Box>
              </Stack>
            ))}
          </Stack>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            alignItems={{ xs: "stretch", sm: "center" }}
            justifyContent="space-between"
            gap={1}
          >
            <Typography
              variant="caption"
              sx={{ color: bodyColor }}
            >
              نمایش مدل‌ها بر اساس موجودی ثبت‌شده هر سایز انجام می‌شود.
            </Typography>
            <Button
              component={Link}
              href={`/store/${storePath?.trim() || DEFAULT_SHOES_STORE_PATH}`}
              size="small"
              variant="outlined"
              sx={{
                color: headingColor,
                borderColor: "var(--mui-palette-divider)",
                alignSelf: { xs: "flex-start", sm: "center" },
                "&:hover": {
                  borderColor: "var(--mui-palette-info-light)",
                  bgcolor: "rgba(var(--mui-palette-info-mainChannel) / 0.08)",
                },
              }}
            >
              مشاهده همه مدل‌ها
            </Button>
          </Stack>
        </Stack>
      </Box>
    </Container>
  );
}
