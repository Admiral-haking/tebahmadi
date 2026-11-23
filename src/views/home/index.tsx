"use server";

import { Box, Container, Grid, Skeleton, Stack } from "@mui/material";
import { Suspense } from "react";
import Categories from "./components/categories";
import { loadSiteConfig, loadSiteInfo } from "@/lib/cache";
import DiscountProducts from "./components/discount";
import PopularProducts from "./components/popular";
import NewestProducts from "./components/newest";
import ConfigurableBanner from "./components/configurable-banner";
import TrustBar from "./components/trust-bar";
import InstagramBanner from "@/layout/components/instagram-banner";
import SocialFollowBanner from "./components/social-follow-banner";
import HomeBlogSection from "./components/blog";

function CategoriesFallback() {
  return (
    <Box sx={{ my: { xs: 4, md: 6 } }}>
      <Skeleton
        variant="text"
        width={220}
        height={40}
        sx={{ mx: "auto", mb: 2 }}
      />
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "repeat(3, minmax(0, 1fr))",
            sm: "repeat(4, minmax(0, 1fr))",
            md: "repeat(5, minmax(0, 1fr))",
          },
          gap: { xs: 1.25, sm: 1.75, md: 2 },
        }}
      >
        {Array.from({ length: 10 }).map((_, index) => (
          <Stack key={index} alignItems="center" spacing={1}>
            <Skeleton variant="circular" width={88} height={88} />
            <Skeleton variant="text" width={64} height={20} />
          </Stack>
        ))}
      </Box>
    </Box>
  );
}

function ProductSectionFallback({ tinted = false }: { tinted?: boolean }) {
  return (
    <Box
      sx={{
        bgcolor: tinted ? "secondary.main" : "transparent",
        width: "100%",
        my: { xs: 3, md: 4 },
        py: { xs: 2, md: 2.5 },
      }}
    >
      <Container maxWidth="md" sx={{ px: { xs: 1.5, sm: 2 } }}>
        <Skeleton variant="text" width={180} height={40} sx={{ mb: 1 }} />
        <Skeleton variant="text" width={280} height={24} sx={{ mb: 2 }} />
        <Grid container spacing={{ xs: 1.25, sm: 1.75 }}>
          {Array.from({ length: 4 }).map((_, index) => (
            <Grid key={index} size={{ xs: 6, sm: 4, md: 3 }}>
              <Skeleton variant="rounded" height={292} />
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box>
  );
}

export default async function HomeView() {
  const [siteInfo, siteConfig] = await Promise.all([
    loadSiteInfo(),
    loadSiteConfig(),
  ]);
  const siteInfoCustomData =
    siteInfo?.customData && typeof siteInfo.customData === "object"
      ? (siteInfo.customData as Record<string, unknown>)
      : {};
  const siteConfigCustomData =
    siteConfig &&
      "customData" in siteConfig &&
      siteConfig.customData &&
      typeof siteConfig.customData === "object"
      ? (siteConfig.customData as Record<string, unknown>)
      : {};
  const siteConfigValues =
    siteConfig?.values && typeof siteConfig.values === "object"
      ? (siteConfig.values as Record<string, unknown>)
      : {};
  const customData = {
    ...siteInfoCustomData,
    ...siteConfigCustomData,
    ...siteConfigValues,
  };
  const homeBannerEnabled = customData.homeBannerEnabled !== false;
  const homeBannerImageUrl =
    homeBannerEnabled && typeof customData.homeBannerImageUrl === "string"
      ? customData.homeBannerImageUrl
      : undefined;
  const homeBannerHref =
    typeof customData.homeBannerHref === "string"
      ? customData.homeBannerHref
      : undefined;
  const homeBannerAlt =
    typeof customData.homeBannerAlt === "string"
      ? customData.homeBannerAlt
      : undefined;

  return (
    <>
      <InstagramBanner />
      <SocialFollowBanner links={siteInfo?.socials} brandName={siteInfo?.appName} />
      <Container
        maxWidth="lg"
        sx={{ position: "relative", px: { xs: 1.5, sm: 2 } }}
      >
        <Suspense fallback={<CategoriesFallback />}>
          {!!siteInfo && <Categories siteInfo={siteInfo} />}
        </Suspense>
      </Container>

      <Suspense fallback={<ProductSectionFallback tinted />}>
        <DiscountProducts />
      </Suspense>

      <Suspense fallback={<ProductSectionFallback />}>
        <PopularProducts />
      </Suspense>

      <Container maxWidth="lg" sx={{ px: { xs: 1.5, sm: 2 } }}>
        <Suspense fallback={<ProductSectionFallback />}>
          <NewestProducts />
        </Suspense>
      </Container>

      <ConfigurableBanner
        imageUrl={homeBannerImageUrl}
        href={homeBannerHref}
        alt={homeBannerAlt}
      />
      <TrustBar />
      <HomeBlogSection authorLabel={siteInfo?.appName} />
    </>
  );
}
