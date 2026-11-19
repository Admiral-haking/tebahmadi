import { Box, Container, Divider, Paper, Stack, Typography } from "@mui/material";

import AppPagination from "@/components/search/pagination";

import { loadBlogIndex, type BlogViewSearchParams } from "./data";
import BlogHero from "./components/hero";
import BlogCategoryFilter from "./components/category-filter";
import BlogPostGrid from "./components/post-grid";
import { loadSiteInfo } from "@/lib/cache";

type BlogViewProps = {
    searchParams: BlogViewSearchParams;
};

export default async function BlogView({ searchParams }: BlogViewProps) {
    const [data, siteInfo] = await Promise.all([loadBlogIndex(searchParams), loadSiteInfo()]);
    const highlightFirst = data.page === 1;

    let heroTitle: string | undefined;
    let heroSubtitle: string | undefined;

    if (siteInfo?.customData && typeof siteInfo.customData === "object") {
        const blogRaw = (siteInfo.customData as Record<string, unknown>)["blog"];
        if (blogRaw && typeof blogRaw === "object") {
            const blogData = blogRaw as Record<string, unknown>;
            const rawTitle = blogData["title"];
            const rawSubtitle = blogData["subtitle"];
            if (typeof rawTitle === "string") {
                heroTitle = rawTitle;
            }
            if (typeof rawSubtitle === "string") {
                heroSubtitle = rawSubtitle;
            }
        }
    }

    const resultDescription = (() => {
        if (data.searchTerm && data.selectedCategory) {
            return `جستجوی "${data.searchTerm}" در دسته‌بندی «${data.selectedCategory.name}»`;
        }
        if (data.searchTerm) {
            return `نتایج برای "${data.searchTerm}"`;
        }
        if (data.selectedCategory) {
            return `نمایش مقالات دسته «${data.selectedCategory.name}»`;
        }
        return "آخرین مقالات";
    })();

    return (
        <Container component="section" maxWidth="lg" sx={{ py: { xs: 6, md: 8 } }}>
            <Stack spacing={{ xs: 4, md: 6 }}>
                <BlogHero
                    searchTerm={data.searchTerm}
                    selectedCategory={data.selectedCategory}
                    total={data.total}
                    allCount={data.allPostsCount}
                    heroTitle={heroTitle}
                    heroSubtitle={heroSubtitle}
                    title={siteInfo?.appName}
                />

                <Paper
                    elevation={0}
                    sx={{
                        p: { xs: 2.5, md: 3 },
                        borderRadius: 4,
                        border: "1px solid",
                        borderColor: "divider",
                        backgroundColor: "var(--mui-palette-background-paper)",
                        backdropFilter: "blur(6px)",
                    }}
                >
                    <Stack spacing={2.5}>
                        <Stack direction={{ xs: "column", md: "row" }} spacing={1} alignItems={{ md: "center" }}>
                            <Typography variant="subtitle1" fontWeight={700}>
                                دسته‌بندی‌ها
                            </Typography>
                            <Divider flexItem sx={{ borderColor: "divider", display: { xs: "none", md: "block" } }} />
                            <Typography variant="body2" color="text.secondary">
                                فیلتر کنید تا سریع‌تر به موضوع مورد نظر برسید.
                            </Typography>
                        </Stack>
                        <BlogCategoryFilter
                            categories={data.categories}
                            selectedCategory={data.selectedCategory}
                            searchParams={searchParams}
                            allCount={data.allPostsCount}
                        />
                    </Stack>
                </Paper>

                <Stack spacing={2}>
                    <Stack direction="row" spacing={1} alignItems="center">
                        <Box
                            sx={{
                                width: 8,
                                height: 8,
                                borderRadius: "50%",
                                bgcolor: "primary.main",
                            }}
                        />
                        <Typography variant="subtitle2" color="text.secondary">
                            {resultDescription}
                        </Typography>
                    </Stack>
                    <BlogPostGrid
                        posts={data.posts}
                        highlightFirst={highlightFirst}
                        emptyMessage="هیچ مقاله‌ای با این شرایط پیدا نکردیم."
                    />
                </Stack>

                {data.pages > 1 && (
                    <Box sx={{ display: "flex", justifyContent: "center" }}>
                        <AppPagination page={data.page} pages={data.pages} />
                    </Box>
                )}
            </Stack>
        </Container>
    );
}
