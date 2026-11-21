"use server";

import { Suspense } from "react";
import { Box, Button, Container, Grid, Skeleton, Stack, Typography } from "@mui/material";
import { Phone } from "lucide-react";
import HomeHero from "./components/hero";
import Categories from "./components/categories";
import DiscountProducts from "./components/discount";
import NewestProducts from "./components/newest";
import PopularProducts from "./components/popular";
import EducationPanel from "./components/education-panel";
import FeaturedArticles from "./components/articles";
import TrustBar from "./components/trust-bar";
import { resolveHomeSections } from "@/config/home-sections";
import { BRAND } from "@/config/brand";
import { TEB_COLORS, TEB_RADII } from "@/theme/tokens";

function ProductGridFallback() {
    return (
        <Container maxWidth="lg" sx={{ py: 3, px: { xs: 1.5, sm: 2.5 } }}>
            <Skeleton variant="text" width={220} height={36} sx={{ mx: "auto", mb: 3 }} />
            <Grid container spacing={2}>
                {Array.from({ length: 4 }).map((_, index) => (
                    <Grid key={index} size={{ xs: 6, md: 3 }}>
                        <Skeleton variant="rounded" height={320} sx={{ borderRadius: `${TEB_RADII.lg}px` }} />
                    </Grid>
                ))}
            </Grid>
        </Container>
    );
}

function ConsultationStrip() {
    return (
        <Container maxWidth="lg" sx={{ py: { xs: 1.5, md: 2 }, px: { xs: 1.5, sm: 2.5 } }}>
            <Stack
                direction={{ xs: "column", sm: "row" }}
                alignItems={{ xs: "flex-start", sm: "center" }}
                justifyContent="space-between"
                gap={2}
                sx={{
                    px: { xs: 2.5, md: 4 },
                    py: { xs: 2.5, md: 3 },
                    borderRadius: `${TEB_RADII.panel}px`,
                    bgcolor: TEB_COLORS.primary,
                    color: "#FFFFFF",
                }}
            >
                <Stack spacing={0.5}>
                    <Typography variant="h5" fontWeight={700} color="#FFFFFF">
                        برای انتخاب دمنوش یا گیاه دارویی مناسب نیاز به راهنمایی دارید؟
                    </Typography>
                    <Typography variant="body2" sx={{ color: "#E5EFEA", fontSize: "13.5px" }}>
                        تیم پشتیبانی طب احمدی همه‌روزه پاسخ‌گوی سؤالات شما درباره انتخاب محصول و پیگیری سفارش است.
                    </Typography>
                </Stack>

                <Button
                    component="a"
                    href={`tel:${BRAND.phone}`}
                    variant="contained"
                    startIcon={<Phone size={17} />}
                    sx={{
                        bgcolor: "#FFFFFF",
                        color: TEB_COLORS.primaryDark,
                        flexShrink: 0,
                        whiteSpace: "nowrap",
                        "&:hover": {
                            bgcolor: TEB_COLORS.softSurface,
                        },
                    }}
                >
                    تماس: {BRAND.phone}
                </Button>
            </Stack>
        </Container>
    );
}

export default async function HomeView() {
    const sections = resolveHomeSections();

    return (
        <Box sx={{ width: "100%" }}>
            {sections.map((section) => {
                switch (section.kind) {
                    case "hero":
                        return <HomeHero key={section.id} />;
                    case "categories":
                        return (
                            <Suspense key={section.id} fallback={<ProductGridFallback />}>
                                <Categories title={section.title} subtitle={section.subtitle} />
                            </Suspense>
                        );
                    case "offers":
                        return (
                            <Box key={section.id}>
                                <Suspense fallback={<ProductGridFallback />}>
                                    <DiscountProducts title={section.title} subtitle={section.subtitle} />
                                </Suspense>
                                <ConsultationStrip />
                            </Box>
                        );
                    case "newest":
                        return (
                            <Suspense key={section.id} fallback={<ProductGridFallback />}>
                                <NewestProducts title={section.title} subtitle={section.subtitle} />
                            </Suspense>
                        );
                    case "popular":
                        return (
                            <Suspense key={section.id} fallback={<ProductGridFallback />}>
                                <PopularProducts title={section.title} subtitle={section.subtitle} />
                            </Suspense>
                        );
                    case "education":
                        return (
                            <EducationPanel
                                key={section.id}
                                title={section.title}
                                subtitle={section.subtitle}
                            />
                        );
                    case "articles":
                        return (
                            <Suspense key={section.id} fallback={<ProductGridFallback />}>
                                <FeaturedArticles title={section.title} subtitle={section.subtitle} />
                            </Suspense>
                        );
                    case "trust":
                        return <TrustBar key={section.id} />;
                    default:
                        return null;
                }
            })}
        </Box>
    );
}
