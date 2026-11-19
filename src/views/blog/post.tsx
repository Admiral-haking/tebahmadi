import { notFound } from "next/navigation";
import {
    Box,
    Chip,
    Container,
    Divider,
    Paper,
    Stack,
    Typography,
} from "@mui/material";

import BlogPostCard from "./components/post-card";
import { loadBlogPost, type BlogPostListItem } from "./data";
import { resolveSiteBaseUrl, toAbsoluteUrl } from "@/seo/utils/url";

const DATE_FORMATTER = new Intl.DateTimeFormat("fa-IR", { dateStyle: "long" });
const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("fa-IR", { dateStyle: "long", timeStyle: "short" });

function formatDate(value: string | null, withTime = false): string | null {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.valueOf())) {
        return null;
    }
    const formatter = withTime ? DATE_TIME_FORMATTER : DATE_FORMATTER;
    return formatter.format(parsed);
}

const proseStyles = {
    "& > *": { marginBlock: 0 },
    "& > * + *": {
        marginBlockStart: { xs: 2, md: 3 },
    },
    "& h1": { fontSize: { xs: "2.2rem", md: "2.6rem" }, fontWeight: 800 },
    "& h2": { fontSize: { xs: "1.9rem", md: "2.2rem" }, fontWeight: 700 },
    "& h3": { fontSize: { xs: "1.6rem", md: "1.9rem" }, fontWeight: 600 },
    "& h4, & h5, & h6": { fontWeight: 600 },
    "& p": { lineHeight: 1.9, fontSize: { xs: "1rem", md: "1.05rem" } },
    "& ul, & ol": {
        paddingInlineStart: { xs: 3, md: 4 },
        display: "flex",
        flexDirection: "column",
        gap: 1,
    },
    "& li": { lineHeight: 1.9 },
    "& blockquote": {
        paddingInlineStart: 3,
        borderInlineStart: "4px solid rgba(var(--mui-palette-common-backgroundChannel) / 0.1)",
        fontStyle: "italic",
        color: "text.secondary",
    },
    "& a": {
        color: "primary.main",
        textDecoration: "underline",
        textUnderlineOffset: "0.35em",
    },
    "& img": {
        maxWidth: "100%",
        borderRadius: 3,
        boxShadow: 3,
    },
    "& code": {
        fontFamily: "'JetBrains Mono', monospace",
        padding: "0.1rem 0.45rem",
        borderRadius: 1,
        backgroundColor: "rgba(var(--mui-palette-common-backgroundChannel) / 0.08)",
        fontSize: "0.88rem",
    },
    "& pre": {
        padding: 3,
        borderRadius: 2,
        overflowX: "auto",
        backgroundColor: "grey.900",
        color: "common.white",
        fontSize: "0.9rem",
        "& code": {
            backgroundColor: "transparent",
            padding: 0,
            display: "block",
        },
    },
    "& hr": {
        border: "none",
        borderBottom: "1px solid",
        borderColor: "divider",
    },
} as const;

function serializeJsonLd(value: unknown): string | null {
    if (!value) return null;
    try {
        return JSON.stringify(value);
    } catch {
        return null;
    }
}

type BlogPostViewProps = {
    slug: string;
};

export default async function BlogPostView({ slug }: BlogPostViewProps) {
    const data = await loadBlogPost(slug);
    if (!data) {
        notFound();
    }

    const { post, related } = data;
    const publishedLabel = formatDate(post.publishedAt);
    const updatedLabel = formatDate(post.updatedAt, true);

    const baseUrl = resolveSiteBaseUrl();
    const canonicalPath = `/blog/${post.slug}`;
    const absoluteUrl = toAbsoluteUrl(canonicalPath, baseUrl);
    const coverAbsoluteUrl = post.coverImageUrl ? toAbsoluteUrl(post.coverImageUrl, baseUrl) : undefined;

    const jsonLd = serializeJsonLd({
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        headline: post.title,
        description: post.excerpt ?? undefined,
        datePublished: post.publishedAt ?? undefined,
        dateModified: post.updatedAt ?? post.publishedAt ?? undefined,
        url: absoluteUrl,
        image: coverAbsoluteUrl ? [coverAbsoluteUrl] : undefined,
    });

    const relatedAsPosts: BlogPostListItem[] = related.map((item) => ({
        id: item.id,
        slug: item.slug,
        title: item.title,
        excerpt: null,
        coverImageUrl: item.coverImageUrl,
        publishedAt: item.publishedAt,
        tags: [],
        categories: [],
    }));

    return (
        <Box component="article">
            <Box
                sx={{
                    position: "relative",
                    overflow: "hidden",
                    borderRadius: { xs: 0, md: 6 },
                    mx: { xs: "-24px", md: 0 },
                    background: post.coverImageUrl
                        ? "linear-gradient(135deg, rgba(var(--mui-palette-primary-mainChannel) / 0.87), rgba(var(--mui-palette-secondary-mainChannel) / 0.8))"
                        : "var(--mui-palette-background-paper)",
                    color: "var(--mui-palette-common-white)",
                }}
            >
                {post.coverImageUrl && (
                    <Box
                        component="img"
                        src={post.coverImageUrl}
                        alt={post.title}
                        sx={{
                            position: "absolute",
                            inset: 0,
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                            opacity: 0.55,
                        }}
                    />
                )}
                <Box
                    sx={{
                        position: "absolute",
                        inset: 0,
                        background:
                            "linear-gradient(180deg, rgba(var(--mui-palette-common-onBackgroundChannel) / 0.65) 0%, rgba(var(--mui-palette-common-onBackgroundChannel) / 0.94) 75%, rgba(var(--mui-palette-common-onBackgroundChannel) / 1) 100%)",
                    }}
                />

                <Container maxWidth="md" sx={{ position: "relative", zIndex: 1, py: { xs: 8, md: 10 } }}>
                    <Stack spacing={3}>
                        <Stack direction="row" flexWrap="wrap" useFlexGap spacing={1.5}>
                            {post.categories.map((category) => (
                                <Chip
                                    key={category.id}
                                    label={category.name}
                                    sx={{
                                        bgcolor: "rgba(var(--mui-palette-common-backgroundChannel) / 0.12)",
                                        color: "inherit",
                                        fontWeight: 600,
                                        px: 1.5,
                                    }}
                                />
                            ))}
                        </Stack>
                        <Typography component="h1" variant="h2" fontWeight={900} sx={{ lineHeight: 1.2 }}>
                            {post.title}
                        </Typography>
                        {post.excerpt && (
                            <Typography variant="h6" sx={{ opacity: 0.9, maxWidth: { md: "85%" } }}>
                                {post.excerpt}
                            </Typography>
                        )}
                        <Stack direction={{ xs: "column", md: "row" }} spacing={{ xs: 1, md: 3 }} sx={{ opacity: 0.85 }}>
                            {publishedLabel && (
                                <Typography variant="body2">تاریخ انتشار: {publishedLabel}</Typography>
                            )}
                            {updatedLabel && (
                                <Typography variant="body2">آخرین بروزرسانی: {updatedLabel}</Typography>
                            )}
                            <Typography variant="body2">
                                زمان مطالعه تقریبی:{" "}
                                {Math.max(2, Math.round(post.content.split(/\s+/).length / 200))} دقیقه
                            </Typography>
                        </Stack>
                    </Stack>
                </Container>
            </Box>

            <Container maxWidth="md" sx={{ py: { xs: 6, md: 8 } }}>
                <Paper
                    elevation={0}
                    sx={{
                        px: { xs: 2.5, md: 4 },
                        py: { xs: 3.5, md: 5 },
                        borderRadius: 4,
                        border: "1px solid",
                        borderColor: "divider",
                        backgroundColor: "var(--mui-palette-background-paper)",
                    }}
                >
                    <Box sx={proseStyles} dangerouslySetInnerHTML={{ __html: post.content }} />
                </Paper>

                {post.tags.length > 0 && (
                    <Stack
                        direction="row"
                        flexWrap="wrap"
                        useFlexGap
                        spacing={1.5}
                        sx={{ mt: { xs: 4, md: 6 }, borderTop: "1px solid", borderColor: "divider", pt: 3 }}
                    >
                        {post.tags.map((tag) => (
                            <Chip
                                key={tag}
                                label={`#${tag}`}
                                sx={{
                                    bgcolor: "rgba(var(--mui-palette-primary-mainChannel) / 0.08)",
                                    color: "var(--mui-palette-primary-main)",
                                    fontWeight: 500,
                                }}
                            />
                        ))}
                    </Stack>
                )}
            </Container>

            {relatedAsPosts.length > 0 && (
                <Container maxWidth="lg" sx={{ pb: { xs: 8, md: 10 } }}>
                    <Stack spacing={2.5}>
                        <Stack direction="row" alignItems="center" spacing={1.5}>
                            <Typography variant="h5" fontWeight={800}>
                                مطالب مرتبط
                            </Typography>
                            <Divider flexItem />
                        </Stack>
                        <Box>
                            <Stack direction={{ xs: "column", md: "row" }} spacing={3}>
                                {relatedAsPosts.map((item) => (
                                    <Box key={item.id} sx={{ flex: { md: 1 } }}>
                                        <BlogPostCard post={item} />
                                    </Box>
                                ))}
                            </Stack>
                        </Box>
                    </Stack>
                </Container>
            )}

            {jsonLd && (
                <Box
                    component="script"
                    type="application/ld+json"
                    sx={{ display: "none" }}
                    dangerouslySetInnerHTML={{ __html: jsonLd }}
                />
            )}
        </Box>
    );
}
