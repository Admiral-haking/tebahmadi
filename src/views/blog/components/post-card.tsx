"use client";

import Link from "next/link";
import {
    Box,
    Card,
    CardActionArea,
    Chip,
    Stack,
    Typography,
} from "@mui/material";

import type { BlogPostListItem } from "../data";

const DATE_FORMATTER = new Intl.DateTimeFormat("fa-IR", {
    dateStyle: "medium",
});

function formatDate(value: string | null): string | null {
    if (!value) {
        return null;
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.valueOf())) {
        return null;
    }
    return DATE_FORMATTER.format(parsed);
}

type BlogPostCardProps = {
    post: BlogPostListItem;
    featured?: boolean;
};

export default function BlogPostCard({ post, featured = false }: BlogPostCardProps) {
    const dateLabel = formatDate(post.publishedAt);
    const primaryCategory = post.categories[0];
    const tagPreview = post.tags.slice(0, 2);

    return (
        <Card
            component="article"
            elevation={0}
            sx={{
                height: "100%",
                display: "flex",
                flexDirection: "column",
                borderRadius: featured ? 5 : 4,
                overflow: "hidden",
                position: "relative",
                border: "1px solid",
                borderColor: "divider",
                backgroundImage: featured
                    ? "linear-gradient(140deg, rgba(var(--mui-palette-primary-mainChannel) / 0.15), rgba(var(--mui-palette-secondary-mainChannel) / 0.15))"
                    : "none",
                transition: "transform .25s ease, box-shadow .25s ease",
                "&:hover": {
                    transform: "translateY(-6px)",
                    boxShadow: featured ? "var(--mui-shadows-12)" : "var(--mui-shadows-8)",
                },
            }}
        >
            <CardActionArea
                LinkComponent={Link}
                href={`/blog/${post.slug}`}
                sx={{
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "stretch",
                }}
            >
                <Box sx={{ position: "relative", width: "100%", pt: featured ? "52%" : "65%" }}>
                    {post.coverImageUrl ? (
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
                                transition: "transform .4s ease",
                            }}
                        />
                    ) : (
                        <Box
                            sx={{
                                position: "absolute",
                                inset: 0,
                                background: "linear-gradient(135deg, rgba(var(--mui-palette-primary-mainChannel) / 0.25), rgba(var(--mui-palette-secondary-mainChannel) / 0.35))",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                color: "rgba(var(--mui-palette-common-backgroundChannel) / 0.75)",
                                fontWeight: 700,
                                letterSpacing: 2,
                            }}
                        >
                            GHL
                        </Box>
                    )}
                    <Box
                        sx={{
                            position: "absolute",
                            inset: 0,
                            background: "linear-gradient(180deg, transparent 0%, rgba(var(--mui-palette-common-onBackgroundChannel) / 0.05) 70%, rgba(var(--mui-palette-common-onBackgroundChannel) / 0.4) 100%)",
                        }}
                    />
                    {primaryCategory && (
                        <Chip
                            label={primaryCategory.name}
                            size="small"
                            sx={{
                                position: "absolute",
                                bottom: 16,
                                right: 16,
                                px: 1.5,
                                color: "var(--mui-palette-common-white)",
                                bgcolor: "rgba(var(--mui-palette-primary-mainChannel) / 0.85)",
                                backdropFilter: "blur(6px)",
                                fontWeight: 600,
                            }}
                        />
                    )}
                </Box>

                <Stack spacing={2} sx={{ px: { xs: 2.5, md: 3 }, py: { xs: 3, md: 3.5 }, alignItems: "flex-start" }}>
                    <Stack spacing={1}>
                        {dateLabel && (
                            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
                                {dateLabel}
                            </Typography>
                        )}
                        <Typography
                            component="h2"
                            variant={featured ? "h5" : "h6"}
                            sx={{
                                fontWeight: 800,
                                lineHeight: 1.4,
                                color: "text.primary",
                                display: "-webkit-box",
                                WebkitLineClamp: featured ? 3 : 2,
                                WebkitBoxOrient: "vertical",
                                overflow: "hidden",
                            }}
                        >
                            {post.title}
                        </Typography>
                    </Stack>

                    {post.excerpt && (
                        <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{
                                display: "-webkit-box",
                                WebkitLineClamp: featured ? 4 : 3,
                                WebkitBoxOrient: "vertical",
                                overflow: "hidden",
                                minHeight: featured ? 76 : 60,
                            }}
                        >
                            {post.excerpt}
                        </Typography>
                    )}

                    {tagPreview.length > 0 && (
                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                            {tagPreview.map((tag) => (
                                <Chip
                                    key={tag}
                                    label={`#${tag}`}
                                    size="small"
                                    sx={{
                                        bgcolor: "rgba(var(--mui-palette-primary-mainChannel) / 0.08)",
                                        color: "var(--mui-palette-primary-main)",
                                        fontWeight: 500,
                                    }}
                                />
                            ))}
                        </Stack>
                    )}
                </Stack>
            </CardActionArea>
        </Card>
    );
}
