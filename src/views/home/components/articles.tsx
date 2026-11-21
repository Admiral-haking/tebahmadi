import React from "react";
import Image from "next/image";
import Link from "next/link";
import { Box, Button, Container, Grid, Stack, Typography } from "@mui/material";
import { ArrowLeft, Calendar, FileText } from "lucide-react";
import { loadBlogIndex } from "@/views/blog/data";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { TEB_COLORS, TEB_RADII } from "@/theme/tokens";

export type FeaturedArticlesProps = {
    title?: string;
    subtitle?: string;
};

const FALLBACK_ARTICLES = [
    {
        id: "art-1",
        slug: "guide-to-calming-herbal-teas",
        title: "خواص و راهنمای جامع مصرف دمنوش‌های آرام‌بخش طبیعی",
        excerpt: "آشنایی با ترکیب گل‌گاوزبان، بابونه و سنبل‌الطیب برای بهبود کیفیت خواب و کاهش استرس روزمره.",
        coverImageUrl: "/images/tebahmadi/herbal-tea.jpg",
        date: "۱۴۰۳/۰۸/۲۵",
    },
    {
        id: "art-2",
        slug: "benefits-of-cold-pressed-oils",
        title: "معجزه روغن‌های طبیعی پرس سرد برای سلامت پوست و مو",
        excerpt: "چرا روش پرس سرد تمام مواد مغذی روغن سیاه‌دانه، بادام و زیتون را بدون افزودنی شیمیایی حفظ می‌کند؟",
        coverImageUrl: "/images/tebahmadi/natural-oil.jpg",
        date: "۱۴۰۳/۰۸/۲۰",
    },
    {
        id: "art-3",
        slug: "raw-mountain-honey-facts",
        title: "ویژگی‌ها و استانداردهای عسل کوهستان خام و ارگانیک",
        excerpt: "بررسی تفاوت عسل خام تغذیه‌نشده با عسل‌های صنعتی و خواص آنتی‌باکتریال آن برای تقویت سیستم ایمنی.",
        coverImageUrl: "/images/tebahmadi/mountain-honey.jpg",
        date: "۱۴۰۳/۰۸/۱۵",
    },
];

export default async function FeaturedArticles({
    title = "مطالب منتخب مجله طب احمدی",
    subtitle = "نکات کاربردی درباره دم‌آوری، نگهداری و شناخت ترکیبات طبیعی",
}: FeaturedArticlesProps) {
    let posts: Array<{
        id: string;
        slug: string;
        title: string;
        excerpt: string | null;
        coverImageUrl: string | null;
        date?: string;
    }> = [];

    try {
        const blogData = await loadBlogIndex({});
        if (blogData && Array.isArray(blogData.posts) && blogData.posts.length > 0) {
            posts = blogData.posts.slice(0, 3).map((p) => ({
                id: p.id,
                slug: p.slug,
                title: p.title,
                excerpt: p.excerpt,
                coverImageUrl: p.coverImageUrl,
                date: p.publishedAt ? new Date(p.publishedAt).toLocaleDateString("fa-IR") : undefined,
            }));
        }
    } catch {
        // Fall back to curated articles
    }

    if (posts.length === 0) {
        posts = FALLBACK_ARTICLES;
    }

    return (
        <Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 }, px: { xs: 1.5, sm: 2.5 } }}>
            <SectionHeader
                title={title}
                subtitle={subtitle}
                href="/blog"
                ctaLabel="مشاهده همه مقالات"
            />

            <Grid container spacing={{ xs: 2, sm: 2.5, md: 3 }} sx={{ mt: 2 }}>
                {posts.map((article) => (
                    <Grid key={article.id} size={{ xs: 12, sm: 6, md: 4 }}>
                        <Box
                            component={Link}
                            href={`/blog/${article.slug}`}
                            sx={{
                                display: "flex",
                                flexDirection: "column",
                                height: "100%",
                                textDecoration: "none",
                                borderRadius: `${TEB_RADII.lg}px`,
                                bgcolor: TEB_COLORS.surface,
                                border: `1px solid ${TEB_COLORS.border}`,
                                overflow: "hidden",
                                transition: "transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease",
                                "&:hover": {
                                    transform: "translateY(-3px)",
                                    boxShadow: "0 10px 24px rgba(42, 90, 68, 0.08)",
                                    borderColor: TEB_COLORS.primary,
                                },
                            }}
                        >
                            <Box
                                sx={{
                                    position: "relative",
                                    width: "100%",
                                    aspectRatio: "16 / 10",
                                    bgcolor: TEB_COLORS.softSurface,
                                }}
                            >
                                {article.coverImageUrl ? (
                                    <Image
                                        src={article.coverImageUrl}
                                        alt={article.title}
                                        fill
                                        sizes="(max-width: 600px) 100vw, (max-width: 900px) 50vw, 380px"
                                        style={{ objectFit: "cover" }}
                                    />
                                ) : (
                                    <Box
                                        sx={{
                                            width: "100%",
                                            height: "100%",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            color: TEB_COLORS.textSecondary,
                                        }}
                                    >
                                        <FileText size={40} opacity={0.3} />
                                    </Box>
                                )}
                            </Box>

                            <Stack spacing={1.5} sx={{ p: 2.5, flex: 1, justifyContent: "space-between" }}>
                                <Stack spacing={1}>
                                    {article.date && (
                                        <Stack direction="row" alignItems="center" spacing={0.75} sx={{ color: TEB_COLORS.textSecondary }}>
                                            <Calendar size={13} />
                                            <Typography variant="caption" sx={{ fontSize: "12px" }}>
                                                {article.date}
                                            </Typography>
                                        </Stack>
                                    )}

                                    <Typography
                                        component="h3"
                                        sx={{
                                            fontSize: "16px",
                                            fontWeight: 700,
                                            lineHeight: 1.5,
                                            color: TEB_COLORS.textPrimary,
                                            display: "-webkit-box",
                                            WebkitLineClamp: 2,
                                            WebkitBoxOrient: "vertical",
                                            overflow: "hidden",
                                        }}
                                    >
                                        {article.title}
                                    </Typography>

                                    {article.excerpt && (
                                        <Typography
                                            variant="body2"
                                            sx={{
                                                fontSize: "13px",
                                                color: TEB_COLORS.textSecondary,
                                                lineHeight: 1.7,
                                                display: "-webkit-box",
                                                WebkitLineClamp: 3,
                                                WebkitBoxOrient: "vertical",
                                                overflow: "hidden",
                                            }}
                                        >
                                            {article.excerpt}
                                        </Typography>
                                    )}
                                </Stack>

                                <Stack direction="row" alignItems="center" spacing={0.5} sx={{ color: TEB_COLORS.primary, pt: 1 }}>
                                    <Typography variant="caption" sx={{ fontWeight: 700 }}>
                                        مطالعه مقاله
                                    </Typography>
                                    <ArrowLeft size={14} />
                                </Stack>
                            </Stack>
                        </Box>
                    </Grid>
                ))}
            </Grid>
        </Container>
    );
}
