"use client";

import { Box, Chip, Divider, Stack, Typography } from "@mui/material";

import SearchBox from "@/components/search";

import type { BlogCategoryItem } from "../data";

const DEFAULT_HERO_TITLE = "دانش طبیعت برای انتخابی آگاهانه";
const DEFAULT_HERO_SUBTITLE =
    "مطالب کاربردی درباره گیاهان دارویی، فرآورده‌های طبیعی و سبک زندگی سالم را بخوانید.";

type BlogHeroProps = {
    searchTerm: string;
    selectedCategory: BlogCategoryItem | null;
    total: number;
    allCount: number;
    heroTitle?: string | null;
    heroSubtitle?: string | null;
    title?: string
};

export default function BlogHero({
    searchTerm,
    selectedCategory,
    total,
    allCount,
    heroTitle,
    heroSubtitle,
    title
}: BlogHeroProps) {
    const sanitizedTitle = typeof heroTitle === "string" ? heroTitle.trim() : "";
    const sanitizedSubtitle = typeof heroSubtitle === "string" ? heroSubtitle.trim() : "";

    const headline = sanitizedTitle.length > 0 ? sanitizedTitle : DEFAULT_HERO_TITLE;
    const baseSubtitle = sanitizedSubtitle.length > 0 ? sanitizedSubtitle : DEFAULT_HERO_SUBTITLE;

    const subtitle = selectedCategory ? `در حال مرور ${selectedCategory.name}` : baseSubtitle;

    return (
        <Box
            sx={{
                position: "relative",
                borderRadius: 5,
                overflow: "hidden",
                px: { xs: 3, md: 6 },
                py: { xs: 6, md: 8 },
                bgcolor: "background.paper",
                border: "1px solid",
                borderColor: "divider",
                background: "linear-gradient(135deg, var(--mui-palette-primary-dark) 0%, var(--mui-palette-secondary-main) 90%)",
                color: "var(--mui-palette-common-white)",
                boxShadow: "0 40px 100px rgba(var(--mui-palette-primary-mainChannel) / 0.13)",
            }}
        >
            <Box
                sx={{
                    position: "absolute",
                    inset: 0,
                    background:
                        "radial-gradient(circle at 20% 20%, rgba(var(--mui-palette-common-backgroundChannel) / 0.15), transparent 45%), radial-gradient(circle at 80% 10%, rgba(var(--mui-palette-common-backgroundChannel) / 0.12), transparent 40%)",
                    pointerEvents: "none",
                }}
            />
            <Stack spacing={{ xs: 3, md: 4 }} sx={{ position: "relative", zIndex: 1 }}>
                <Stack spacing={2}>
                    <Stack direction="row" alignItems="center" spacing={2}>
                        <Typography variant="overline" sx={{ letterSpacing: 4, opacity: 0.8 }}>
                            مجله {title}
                        </Typography>
                        <Divider flexItem sx={{ borderColor: "rgba(var(--mui-palette-common-backgroundChannel) / 0.3)" }} />
                    </Stack>
                    <Typography component="h1" variant="h3" fontWeight={800} sx={{ lineHeight: 1.2 }}>
                        {headline}
                    </Typography>
                    <Typography variant="h6" sx={{ maxWidth: { md: "70%" }, opacity: 0.9 }}>
                        {subtitle}
                    </Typography>
                </Stack>

                <Stack
                    direction={{ xs: "column", md: "row" }}
                    spacing={2}
                    alignItems={{ xs: "stretch", md: "center" }}
                    justifyContent="space-between"
                >
                    <SearchBox
                        onSearchUrl="/blog"
                        alwaysShowSearch
                        initialQuery={searchTerm}
                        preserveQueryParams
                        placeholder="دنبال چه محتوایی می‌گردید؟"
                        boxSx={{
                            maxWidth: { xs: "100%", md: 420 },
                            borderRadius: 4,
                            border: "1px solid rgba(var(--mui-palette-common-backgroundChannel) / 0.25)",
                            background: "rgba(var(--mui-palette-common-onBackgroundChannel) / 0.18)",
                            backdropFilter: "blur(6px)",
                        }}
                        sx={{
                            color: "inherit",
                            "& input": { color: "inherit" },
                            "& input::placeholder": { color: "rgba(var(--mui-palette-common-backgroundChannel) / 0.72)" },
                        }}
                    />
                    <Stack direction="row" spacing={1.5} alignItems="center">
                        <Chip
                            label={`${allCount} مقاله`}
                            sx={{
                                bgcolor: "rgba(var(--mui-palette-common-backgroundChannel) / 0.15)",
                                color: "inherit",
                                fontWeight: 600,
                                px: 2,
                                "& .MuiChip-label": { px: 1 },
                            }}
                        />
                        <Typography variant="body2" sx={{ opacity: 0.85 }}>
                            {total === allCount ? "همه مقالات نمایش داده می‌شوند" : `${total} نتیجه پیدا شد`}
                        </Typography>
                    </Stack>
                </Stack>
            </Stack>
        </Box>
    );
}
