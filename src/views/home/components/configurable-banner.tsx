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
      maxWidth="lg"
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
          aspectRatio: { xs: '16 / 9', md: '3 / 1' },
          maxHeight: 380,
          borderRadius: { xs: 4, md: 7 },
          border: "1px solid",
          borderColor: "divider",
          bgcolor: "background.default",
          boxShadow: "0 14px 40px rgba(42, 90, 68, .1)",
          animation: "homeBannerReveal .35s ease-out both",
          "@keyframes homeBannerReveal": {
            "0%": { opacity: 0, transform: "translateY(10px) scale(.985)" },
            "100%": { opacity: 1, transform: "translateY(0) scale(1)" },
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
            objectFit: "cover",
            bgcolor: "background.default",
          }}
        />
      </Box>
    </Container>
  );
}
