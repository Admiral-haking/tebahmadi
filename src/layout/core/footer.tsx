"use server";

import React from "react";
import { Box, Container, Divider, Stack, Typography } from "@mui/material";
import Grid from "@mui/material/Grid";
import Link from "next/link";

import Logo from "@/components/logo";
import { BRAND } from "@/config/brand";
import { loadSiteInfo } from "@/lib/cache";
import Socials from "../components/socials";

const quickLinks = [
  { href: "/store", label: "فروشگاه" },
  { href: "/orders", label: "پیگیری سفارش" },
  { href: "/cart", label: "سبد خرید" },
  { href: "/auth", label: "حساب کاربری" },
];

const contentLinks = [
  { href: "/blog", label: "دانشنامه" },
  { href: "/page/about", label: "درباره طب احمدی" },
  { href: "/page/terms", label: "شرایط خرید" },
  { href: "/page/privacy", label: "حریم خصوصی" },
];

export default async function Footer() {
  const siteInfo = await loadSiteInfo();
  const appName = siteInfo?.appName ?? BRAND.name;
  const phones = siteInfo?.phones ?? [{ number: BRAND.phone, label: "پشتیبانی" }];
  const addresses = siteInfo?.addresses ?? [];
  const socials = siteInfo?.socials ?? [];
  const bio = siteInfo?.bio ?? siteInfo?.description ?? BRAND.bio;
  const customData = siteInfo?.customData ?? {};
  const enamadCode = typeof customData.enamad === "string" ? customData.enamad.trim() : "";
  const enamadLink = typeof customData.enamadLink === "string" ? customData.enamadLink.trim() : "";

  let enamadImageSrc: string | null = null;
  try {
    const parsed = new URL(enamadLink);
    const id = parsed.hostname === "trustseal.enamad.ir" ? parsed.searchParams.get("id") : null;
    if (id && enamadCode) {
      enamadImageSrc = `https://trustseal.enamad.ir/logo.aspx?id=${encodeURIComponent(id)}&Code=${encodeURIComponent(enamadCode)}`;
    }
  } catch {
    enamadImageSrc = null;
  }

  return (
    <Box component="footer" sx={{ mt: { xs: 5, md: 8 }, bgcolor: "rgba(42, 90, 68, .055)", borderTop: "1px solid", borderColor: "divider" }}>
      <Container maxWidth="lg" sx={{ px: { xs: 2, sm: 3 }, py: { xs: 4, md: 6 } }}>
        <Grid container spacing={{ xs: 4, md: 3 }}>
          <Grid size={{ xs: 12, md: 4 }}>
            <Stack gap={2} alignItems="flex-start">
              <Logo size={52} showName />
              <Typography color="text.secondary" sx={{ lineHeight: 2, maxWidth: 420, fontSize: 14 }}>
                {bio}
              </Typography>
              <Socials links={socials} />
            </Stack>
          </Grid>

          <Grid size={{ xs: 6, md: 2 }}>
            <FooterLinks title="دسترسی سریع" items={quickLinks} />
          </Grid>
          <Grid size={{ xs: 6, md: 2 }}>
            <FooterLinks title="راهنمای خرید" items={contentLinks} />
          </Grid>

          <Grid size={{ xs: 12, md: 4 }}>
            <Stack gap={1.5} alignItems="flex-start">
              <Typography fontWeight={700}>ارتباط با طب احمدی</Typography>
              {phones.map((phone, index) => (
                <Typography
                  key={`${phone.number}-${index}`}
                  component="a"
                  href={`tel:${phone.number.replace(/\s+/g, "")}`}
                  dir="ltr"
                  sx={{ color: "primary.main", fontWeight: 700 }}
                >
                  {phone.number}
                </Typography>
              ))}
              {addresses.map((item, index) => (
                <Typography key={`${item.address}-${index}`} variant="body2" color="text.secondary" sx={{ lineHeight: 1.9 }}>
                  {item.label ? `${item.label}: ` : ""}{item.address}
                </Typography>
              ))}
              {enamadImageSrc ? (
                <Link href={enamadLink} target="_blank" referrerPolicy="origin" aria-label="نماد اعتماد الکترونیکی طب احمدی">
                  <Box
                    component="img"
                    src={enamadImageSrc}
                    alt="نماد اعتماد الکترونیکی طب احمدی"
                    width={88}
                    height={88}
                    loading="lazy"
                    sx={{ display: "block", objectFit: "contain", bgcolor: "#fff", borderRadius: 2, p: 0.75 }}
                  />
                </Link>
              ) : null}
            </Stack>
          </Grid>
        </Grid>

        <Divider sx={{ my: 3 }} />
        <Stack direction={{ xs: "column", sm: "row" }} gap={1} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "center" }}>
          <Typography variant="caption" color="text.secondary">
            © {new Date().getFullYear()} {appName} — تمامی حقوق محفوظ است.
          </Typography>
          <Typography variant="caption" color="text.secondary">
            اصالت طبیعت، عیار تندرستی
          </Typography>
        </Stack>
      </Container>
    </Box>
  );
}

function FooterLinks({ title, items }: { title: string; items: Array<{ href: string; label: string }> }) {
  return (
    <Stack gap={1.25} alignItems="flex-start">
      <Typography fontWeight={700} sx={{ mb: 0.5 }}>{title}</Typography>
      {items.map((item) => (
        <Typography key={item.href} component={Link} href={item.href} variant="body2" color="text.secondary" sx={{ "&:hover": { color: "primary.main" } }}>
          {item.label}
        </Typography>
      ))}
    </Stack>
  );
}
