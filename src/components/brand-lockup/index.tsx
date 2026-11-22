import React from "react";
import { Box, Stack, Typography } from "@mui/material";
import { BRAND } from "../../config/brand";
import { brandTokens } from "../../theme/design-system";

type BrandLockupProps = {
  size?: number;
  showName?: boolean;
  compact?: boolean;
};

/**
 * The local, layout-safe brand lockup used anywhere the CMS logo is unavailable.
 * It deliberately has no dependency on a media id, so a broken upload cannot
 * crop the header or leave a broken-image icon in a modal/menu.
 */
export default function BrandLockup({ size = 44, showName = true, compact = false }: BrandLockupProps) {
  return (
    <Stack
      component="span"
      direction="row"
      alignItems="center"
      spacing={showName ? 1 : 0}
      dir="rtl"
      role="img"
      aria-label={BRAND.name}
      sx={{
        minWidth: 0,
        flexShrink: 0,
        whiteSpace: "nowrap",
        lineHeight: 1,
      }}
    >
      <Box
        component="img"
        src="/tebahmadi-mark.svg"
        alt=""
        aria-hidden="true"
        width={size}
        height={size}
        sx={{
          display: "block",
          width: size,
          height: size,
          flex: "0 0 auto",
          objectFit: "contain",
        }}
      />
      {showName ? (
        <Box component="span" sx={{ minWidth: 0, display: "inline-flex", flexDirection: "column", gap: 0.4 }}>
          <Typography
            component="span"
            sx={{
              color: brandTokens.color.primaryDeep,
              fontSize: compact ? Math.max(size * 0.33, 13) : Math.max(size * 0.38, 14),
              fontWeight: 800,
              lineHeight: 1.1,
            }}
          >
            {BRAND.name}
          </Typography>
          {!compact ? (
            <Typography component="span" sx={{ color: "text.secondary", fontSize: Math.max(size * 0.2, 9), lineHeight: 1.1 }}>
              اصالت طبیعت، عیار تندرستی
            </Typography>
          ) : null}
        </Box>
      ) : null}
    </Stack>
  );
}
