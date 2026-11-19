"use client";

import Link from "next/link";
import { useState } from "react";
import { Box, Container } from "@mui/material";

type ConfigurableBannerProps = {
  imageUrl?: string;
  href?: string;
  alt?: string;
};

export default function ConfigurableBanner({
  imageUrl,
  href,
  alt,
}: ConfigurableBannerProps) {
  const [failed, setFailed] = useState(false);
  const rawImageUrl = imageUrl?.trim();
  const cleanImageUrl =
    rawImageUrl && /^[0-9a-fA-F]{24}$/.test(rawImageUrl)
      ? `/api/media/${rawImageUrl}`
      : rawImageUrl;
  if (!cleanImageUrl || failed) {
    return null;
  }

  const cleanHref = href?.trim() || "/store";

  return (
    <Container
      maxWidth="md"
      sx={{
        px: { xs: 1.5, sm: 2 },
        mt: { xs: 1.5, md: 2 },
        mb: { xs: 2, md: 2.5 },
      }}
    >
      <Box
        component={Link}
        href={cleanHref}
        sx={{
          position: "relative",
          display: "block",
          overflow: "hidden",
          // Reserve the exact height up-front so the banner image never pushes
          // the rest of the page down when it loads (was a major CLS source).
          height: { xs: 220, sm: 280, md: 340 },
          borderRadius: 2,
          border: "1px solid",
          borderColor: "divider",
          bgcolor: "background.default",
          boxShadow: "0 10px 28px rgba(var(--mui-palette-text-primaryChannel) / 0.12)",
          animation:
            "homeBannerReveal .45s ease-out both, homeBannerFloat 5.8s ease-in-out .45s infinite",
          "@keyframes homeBannerReveal": {
            "0%": { opacity: 0, transform: "translateY(10px) scale(.985)" },
            "100%": { opacity: 1, transform: "translateY(0) scale(1)" },
          },
          "@keyframes homeBannerFloat": {
            "0%, 100%": { transform: "translateY(0) scale(1)" },
            "50%": { transform: "translateY(-4px) scale(1.003)" },
          },
          "&:after": {
            content: '""',
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(105deg, transparent 0%, rgba(var(--mui-palette-common-backgroundChannel) / 0.28) 42%, transparent 58%)",
            transform: "translateX(120%)",
            animation: "homeBannerShine 5.5s ease-in-out infinite",
          },
          "@keyframes homeBannerShine": {
            "0%, 55%": { transform: "translateX(120%)" },
            "75%, 100%": { transform: "translateX(-120%)" },
          },
        }}
      >
        <Box
          component="img"
          src={cleanImageUrl}
          alt={alt?.trim() || "home banner"}
          onError={() => setFailed(true)}
          loading="lazy"
          decoding="async"
          sx={{
            display: "block",
            width: "100%",
            height: "100%",
            objectFit: "contain",
            bgcolor: "background.default",
          }}
        />
      </Box>
    </Container>
  );
}
