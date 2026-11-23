import ArrowBackIosNewRounded from "@mui/icons-material/ArrowBackIosNewRounded";
import PersonOutlineRounded from "@mui/icons-material/PersonOutlineRounded";
import { Box, Button, Container, Grid, Stack, Typography } from "@mui/material";
import Link from "next/link";

import { loadBlogIndex, type BlogPostListItem } from "../../blog/data";
import { formatBlogPostAge, getBlogCoverImage, selectHomeBlogPosts } from "./blog-helpers";

export { formatBlogPostAge, getBlogCoverImage, selectHomeBlogPosts } from "./blog-helpers";

export async function loadHomeBlogPosts(): Promise<BlogPostListItem[]> {
  try {
    const data = await loadBlogIndex({});
    return selectHomeBlogPosts(data.posts);
  } catch {
    return [];
  }
}

function HomeBlogCard({
  post,
  index,
  authorLabel,
}: {
  post: BlogPostListItem;
  index: number;
  authorLabel: string;
}) {
  const dateLabel = formatBlogPostAge(post.publishedAt);

  return (
    <Box
      component={Link}
      href={`/blog/${post.slug}`}
      aria-label={`مطالعه مطلب ${post.title}`}
      sx={{
        display: "block",
        height: "100%",
        color: "inherit",
        textDecoration: "none",
        "&:focus-visible": {
          outline: "3px solid",
          outlineColor: "primary.main",
          outlineOffset: 4,
          borderRadius: 2,
        },
      }}
    >
      <Box component="article" sx={{ height: "100%", minWidth: 0 }}>
        <Box
          component="img"
          src={getBlogCoverImage(post)}
          alt={post.title}
          loading={index === 0 ? "eager" : "lazy"}
          decoding="async"
          sx={{
            display: "block",
            width: "100%",
            aspectRatio: "16 / 9",
            objectFit: "cover",
            borderRadius: 2,
            bgcolor: "rgba(42, 90, 68, .06)",
            transition: "transform .2s ease",
            "a:hover &": { transform: "scale(1.015)" },
          }}
        />

        <Stack spacing={0.75} sx={{ px: { xs: 0.5, sm: 1 }, pt: 1.25, textAlign: "right" }}>
          {dateLabel ? (
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10.5 }}>
              {dateLabel}
            </Typography>
          ) : null}
          <Typography
            component="h3"
            sx={{
              color: "primary.main",
              fontSize: { xs: 13, sm: 14 },
              fontWeight: 800,
              lineHeight: 1.8,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              minHeight: { xs: 46, sm: 50 },
            }}
          >
            {post.title}
          </Typography>
          <Stack direction="row" spacing={0.5} alignItems="center" color="text.secondary">
            <PersonOutlineRounded sx={{ fontSize: 17 }} aria-hidden />
            <Typography variant="caption" sx={{ fontSize: 10.5 }}>
              {authorLabel}
            </Typography>
          </Stack>
        </Stack>
      </Box>
    </Box>
  );
}

export function HomeBlogCards({
  posts,
  authorLabel = "طب احمدی",
}: {
  posts: readonly BlogPostListItem[];
  authorLabel?: string;
}) {
  const visiblePosts = selectHomeBlogPosts(posts);
  if (visiblePosts.length === 0) {
    return null;
  }

  return (
    <Container maxWidth="lg" sx={{ px: { xs: 1.5, sm: 2 } }}>
      <Stack
        alignItems="center"
        gap={0.5}
        sx={{ mb: { xs: 2.5, md: 3.5 }, textAlign: "center" }}
      >
        <Box
          aria-hidden
          sx={{
            width: 34,
            height: 18,
            position: "relative",
            "&::before": {
              content: '""',
              position: "absolute",
              inset: 0,
              background: "repeating-conic-gradient(from 0deg, #b69a68 0deg 8deg, transparent 8deg 22deg)",
              mask: "radial-gradient(circle, transparent 0 5px, #000 6px)",
            },
          }}
        />
        <Typography component="h2" sx={{ color: "primary.main", fontSize: { xs: "1.45rem", md: "1.8rem" }, fontWeight: 800 }}>
          مطالب بلاگ
        </Typography>
        <Button
          component={Link}
          href="/blog"
          variant="text"
          size="small"
          endIcon={<ArrowBackIosNewRounded sx={{ fontSize: "12px !important" }} aria-hidden />}
          sx={{ minHeight: 32, color: "text.secondary", fontSize: 11 }}
        >
          مشاهده همه
        </Button>
      </Stack>

      <Grid container spacing={{ xs: 2, sm: 2.5 }} dir="rtl">
        {visiblePosts.map((post, index) => (
          <Grid key={post.id || post.slug} size={{ xs: 12, sm: 4 }}>
            <HomeBlogCard post={post} index={index} authorLabel={authorLabel.trim() || "طب احمدی"} />
          </Grid>
        ))}
      </Grid>
    </Container>
  );
}

export default async function HomeBlogSection({ authorLabel }: { authorLabel?: string }) {
  const posts = await loadHomeBlogPosts();
  if (posts.length === 0) {
    return null;
  }

  return (
    <Box component="section" aria-labelledby="home-blog-title" sx={{ my: { xs: 6, md: 8 } }}>
      <HomeBlogCards posts={posts} authorLabel={authorLabel} />
    </Box>
  );
}
