"use server";

import Logo from "@/components/logo";
import { loadSiteInfo } from "@/lib/cache";
import { Container, Divider, Stack, Typography } from "@mui/material";
import Grid from "@mui/material/Grid";
import Link from "next/link";
import Socials from "../components/socials";
import { BRAND } from "@/config/brand";

export default async function Footer() {
  const siteInfo = await loadSiteInfo();
  const appName = siteInfo?.appName ?? BRAND.name;
  const addresses = siteInfo?.addresses ?? [];
  const phones = siteInfo?.phones ?? [];
  const bio = siteInfo?.bio ?? siteInfo?.description ?? '';
  const socials = siteInfo?.socials ?? [];
  const cd = siteInfo?.customData ?? {};
  const enamadCode = typeof cd.enamad === 'string' ? cd.enamad.trim() : '';
  const enamadLink = typeof cd.enamadLink === 'string' ? cd.enamadLink.trim() : '';
  let enamadImageSrc: string | null = null;
  try {
    const parsed = new URL(enamadLink);
    const id = parsed.hostname === 'trustseal.enamad.ir' ? parsed.searchParams.get('id') : null;
    if (id && enamadCode) {
      enamadImageSrc = `https://trustseal.enamad.ir/logo.aspx?id=${encodeURIComponent(id)}&Code=${encodeURIComponent(enamadCode)}`;
    }
  } catch {
    enamadImageSrc = null;
  }

  return (
    <>
      <Container maxWidth="lg">
        <Grid container spacing={0.5}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Stack gap={2} alignItems={{ xs: 'center', md: 'flex-start' }} sx={{
              '& a': { color: 'text.primary' }
            }}>
              <Logo size={120} showName />

              <Stack gap={0.5} alignItems={{ xs: 'center', md: 'flex-start' }}>
                {addresses.length > 0 ? (
                  addresses.map((item, index) => (
                    <Typography key={`${item.address}-${index}`} variant="caption" textAlign={{ xs: 'center', md: 'start' }}>
                      {item.label ? `${item.label}: ${item.address}` : item.address}
                    </Typography>
                  ))
                ) : null}
              </Stack>
            </Stack>
          </Grid>

          <Grid size={{ xs: 12, sm: 6 }}>
            <Stack alignItems="flex-end" sx={{ width: '100%' }} spacing={1.5}>
              <Socials links={socials} />
              {phones.length > 0 ? (
                phones.map((phone, index) => (
                  <Stack key={`${phone.number}-${index}`} direction="row-reverse" alignItems="center" gap={1} sx={{ direction: 'ltr' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width={18} height={18} viewBox="0 0 24 24">
                      <g fill="none">
                        <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="m15 9l4-4m0 0v3m0-3h-3"></path>
                        <path fill="currentColor" d="m15.556 14.548l-.455.48s-1.083 1.139-4.038-1.972s-1.872-4.25-1.872-4.25l.287-.303c.706-.744.773-1.938.156-2.81L8.374 3.91C7.61 2.83 6.135 2.688 5.26 3.609L3.691 5.26c-.433.457-.723 1.048-.688 1.705c.09 1.68.808 5.293 4.812 9.51c4.247 4.47 8.232 4.648 9.861 4.487c.516-.05.964-.329 1.325-.709l1.42-1.496c.96-1.01.69-2.74-.538-3.446l-1.91-1.1c-.806-.463-1.787-.327-2.417.336"></path>
                      </g>
                    </svg>
                    <Typography>{phone.label ? `${phone.label}: ${phone.number}` : phone.number}</Typography>
                  </Stack>
                ))
              ) : null}
            </Stack>
          </Grid>
        </Grid>

        <Divider sx={{ my: 2 }} />

        <Grid container spacing={0.5}>
          <Grid size={{ xs: 12, md: 8 }}>
            <Typography variant="h6">{appName}</Typography>
            <Typography variant="caption" color="text.secondary">
              {bio || BRAND.bio}
            </Typography>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <Stack justifyContent="end" direction="row" gap={1} alignItems="center" flexWrap="wrap">
              {enamadImageSrc ? (
                <Link href={enamadLink} target="_blank" referrerPolicy="origin" aria-label="نماد اعتماد الکترونیکی طب احمدی">
                  <img
                    src={enamadImageSrc}
                    alt="نماد اعتماد الکترونیکی طب احمدی"
                    width={90}
                    height={90}
                    loading="lazy"
                    style={{ display: 'block', objectFit: 'contain' }}
                  />
                </Link>
              ) : null}
            </Stack>
          </Grid>
        </Grid>
      </Container>

      <Divider sx={{ my: 2 }} />
      <Stack alignItems="center" justifyContent="center" sx={{ py: 2.25 }}>
        <Typography variant="caption" textAlign="center" component="div">
          © {new Date().getFullYear()} {BRAND.name} — اصالت طبیعت، عیار تندرستی
        </Typography>
      </Stack>
    </>
  );
}
