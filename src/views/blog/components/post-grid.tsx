"use client";

import { Grid, Typography, Stack, Box } from "@mui/material";

import BlogPostCard from "./post-card";
import type { BlogPostListItem } from "../data";

type BlogPostGridProps = {
    posts: BlogPostListItem[];
    highlightFirst?: boolean;
    emptyMessage?: string;
};

export default function BlogPostGrid({ posts, highlightFirst = false, emptyMessage }: BlogPostGridProps) {
    if (!posts.length) {
        return (
            <Stack
                spacing={2}
                alignItems="center"
                justifyContent="center"
                sx={{
                    borderRadius: 4,
                    border: "1px dashed",
                    borderColor: "divider",
                    py: 10,
                    px: 4,
                    textAlign: "center",
                    bgcolor: "background.paper",
                }}
            >
                <Box
                    sx={{
                        width: 64,
                        height: 64,
                        borderRadius: "50%",
                        background: "linear-gradient(135deg, rgba(var(--mui-palette-primary-lightChannel) / 0.13), rgba(var(--mui-palette-secondary-mainChannel) / 0.2))",
                        display: "grid",
                        placeItems: "center",
                        color: "var(--mui-palette-primary-main)",
                        mb: 1,
                    }}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width={28} height={28} viewBox="0 0 24 24">
                        <path
                            fill="currentColor"
                            d="M12 3.48c-5.64 0-8.52 3.27-8.52 6.79c0 2.84 1.8 5.33 4.62 6.27c.36.09.63.03.72-.27c.06-.18.21-.63.27-.81c.09-.27 0-.42-.18-.6c-.9-.33-1.62-1.29-1.62-2.31c0-1.35 1.02-2.64 2.58-2.64c1.41 0 2.4.93 2.4 2.22c0 1.47-.78 2.34-1.77 2.34c-.42 0-.75-.33-.66-.75c.12-.54.36-1.11.36-1.5c0-.33-.18-.6-.54-.6c-.45 0-.81.45-.81 1.05c0 .96.51 1.77 1.29 1.77c.78 0 1.38-.81 1.38-2.07c0-1.2-.87-2.04-2.13-2.04c-1.44 0-2.37 1.08-2.37 2.28c0 .42.15.87.33 1.11c.03.03.03.06.03.12c-.03.12-.12.39-.15.45c-.03.06-.06.09-.15.06c-.57-.27-.93-1.11-.93-1.8c0-1.47 1.05-2.82 3.03-2.82c1.59 0 2.82 1.14 2.82 2.67c0 1.59-.9 2.73-2.22 2.73c-.45 0-.87-.24-1.02-.51c0 0-.24.93-.27 1.08c-.09.33-.33.75-.48 1.02c.45.12.93.18 1.41.18c5.64 0 8.52-3.27 8.52-6.79C20.52 6.75 17.64 3.48 12 3.48"
                        ></path>
                    </svg>
                </Box>
                <Typography variant="h6" fontWeight={700}>
                    {emptyMessage ?? "محتوایی یافت نشد"}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 520 }}>
                    جستجوی خود را تغییر دهید یا دسته‌بندی دیگری را انتخاب کنید تا مطالب بیشتری ببینید.
                </Typography>
            </Stack>
        );
    }

    const [featured, ...rest] = highlightFirst ? posts : [null, ...posts];

    return (
        <Grid container spacing={3}>
            {featured && (
                <Grid size={{ xs: 12 }}>
                    <BlogPostCard post={featured} featured />
                </Grid>
            )}
            {rest.map((post) => (
                post ?
                    <Grid key={post?.id} size={{ xs: 12, sm: 6, md: 4 }}>
                        <BlogPostCard post={post} />
                    </Grid> : null
            ))}
        </Grid>
    );
}
