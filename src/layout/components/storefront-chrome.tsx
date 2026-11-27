import React from "react";
import { Box, Container, Stack, Typography } from "@mui/material";
import Link from "next/link";

import { brandTokens, glassSurface } from "../../theme/design-system";

export function AnnouncementBar() {
  return (
    <Box
      component="aside"
      className="teb-announcement"
      aria-label="اطلاعیه فروشگاه"
      sx={{
        bgcolor: "#171b12",
        color: "#fff",
        minHeight: { xs: 38, md: 42 },
        display: "flex",
        alignItems: "center",
      }}
    >
      <Container className="teb-announcement__container" maxWidth="lg" sx={{ minWidth: 0 }}>
        <Stack
          className="teb-announcement__inner"
          direction="row"
          alignItems="center"
          justifyContent="center"
          gap={{ xs: 1, sm: 2 }}
          sx={{ py: 0.75, textAlign: "center", width: "100%", minWidth: 0 }}
        >
          <Typography className="teb-announcement__text" sx={{ minWidth: 0, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: { xs: 10.5, sm: 13 }, lineHeight: 1.6 }}>
            پیشنهادهای تازه طب احمدی را از دست ندهید
          </Typography>
          <Box
            component={Link}
            className="teb-announcement__link"
            href="/store"
            sx={{
              flexShrink: 0,
              color: "#fff",
              border: "1px solid rgba(255,255,255,.35)",
              borderRadius: brandTokens.radius.pill,
              px: 1.5,
              py: 0.35,
              fontSize: 11,
              fontWeight: 700,
              "&:hover": { bgcolor: "rgba(255,255,255,.12)" },
            }}
          >
            خرید محصولات
          </Box>
        </Stack>
      </Container>
    </Box>
  );
}

const navItems = [
  { href: "/", label: "خانه", icon: "M3 11.5 12 4l9 7.5V21h-6v-6H9v6H3z" },
  { href: "/store", label: "فروشگاه", icon: "M4 7h16l-1 13H5zM7 7V5a5 5 0 0 1 10 0v2" },
  { href: "/cart", label: "سبد", icon: "M3 4h2l2 11h10l2-8H6M9 20h.01M16 20h.01" },
  { href: "/orders", label: "سفارش‌ها", icon: "M5 4h14v16H5zM8 8h8M8 12h8M8 16h5" },
] as const;

export function MobileBottomNav() {
  return (
    <Box
      component="nav"
      className="teb-mobile-bottom-nav"
      aria-label="دسترسی سریع موبایل"
      sx={{
        ...glassSurface,
        display: { xs: "block", md: "none" },
        position: "fixed",
        insetInline: 0,
        bottom: 0,
        zIndex: 1200,
        borderRadius: 0,
        boxShadow: "0 -8px 24px rgba(31,70,53,.10)",
        borderInline: 0,
        borderBottom: 0,
        pb: "env(safe-area-inset-bottom)",
      }}
    >
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          minHeight: 72,
        }}
      >
        {navItems.map((item) => (
          <Stack
            key={item.href}
            component={Link}
            href={item.href}
            alignItems="center"
            justifyContent="center"
            gap={0.35}
            sx={{ color: item.href === "/" ? "primary.main" : "text.secondary", minWidth: 0, "&:hover": { color: "primary.main" } }}
          >
            <Box component="span" sx={{ width: 36, height: 36, borderRadius: "50%", display: "grid", placeItems: "center", bgcolor: item.href === "/" ? "primary.main" : "#f3f2e5", color: item.href === "/" ? "#fff" : "primary.main" }}>
            <Box component="svg" viewBox="0 0 24 24" sx={{ width: 20, height: 20 }}>
              <path d={item.icon} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
            </Box>
            </Box>
            <Typography component="span" sx={{ fontSize: 10.5, fontWeight: 600 }}>
              {item.label}
            </Typography>
          </Stack>
        ))}
      </Box>
    </Box>
  );
}
