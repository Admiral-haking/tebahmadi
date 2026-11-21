import Link from "next/link";
import { Box, Breadcrumbs, Stack, Typography } from "@mui/material";
import { ChevronLeft } from "lucide-react";
import type { StoreCategoryContext } from "../data";
import { loadRootCategories } from "../data";
import type { StoreViewSearchParams } from "..";
import { StoreCatalogToolbar } from "./store-catalog-toolbar.client";
import { TEB_COLORS, TEB_RADII } from "@/theme/tokens";

export default async function Hero({
    category,
    searchParams,
}: {
    category: StoreCategoryContext;
    searchParams: StoreViewSearchParams;
    siteTitle?: string;
}) {
    const rootCategories = await loadRootCategories();

    return (
        <Stack spacing={2.5}>
            <Box
                sx={{
                    p: { xs: 2.5, md: 3.5 },
                    borderRadius: `${TEB_RADII.lg}px`,
                    bgcolor: TEB_COLORS.softSurface,
                    border: `1px solid ${TEB_COLORS.border}`,
                }}
            >
                <Breadcrumbs
                    separator={<ChevronLeft size={14} color={TEB_COLORS.textSecondary} />}
                    aria-label="مسیر دسته‌بندی"
                    sx={{ mb: 1, fontSize: "12.5px" }}
                >
                    <Box component={Link} href="/" sx={{ color: TEB_COLORS.textSecondary }}>
                        خانه
                    </Box>
                    <Box component={Link} href="/store" sx={{ color: TEB_COLORS.textSecondary }}>
                        فروشگاه
                    </Box>
                    {category.breadcrumbs.map((crumb, index) => {
                        const isLast = index === category.breadcrumbs.length - 1;
                        return isLast ? (
                            <Typography key={crumb.id} variant="caption" fontWeight={700} color={TEB_COLORS.primary}>
                                {crumb.name}
                            </Typography>
                        ) : (
                            <Box
                                key={crumb.id}
                                component={Link}
                                href={`/store/${crumb.path}`}
                                sx={{ color: TEB_COLORS.textSecondary }}
                            >
                                {crumb.name}
                            </Box>
                        );
                    })}
                </Breadcrumbs>

                <Typography variant="h2" sx={{ fontSize: { xs: "22px", md: "28px" }, fontWeight: 800 }}>
                    {category.active.name}
                </Typography>
                {category.root.seoDescription && (
                    <Typography variant="body2" sx={{ color: TEB_COLORS.textSecondary, mt: 0.75 }}>
                        {category.root.seoDescription}
                    </Typography>
                )}
            </Box>

            <StoreCatalogToolbar
                categories={rootCategories}
                activeCategoryPath={category.active.path}
                filterAttributes={category.filterAttributes}
                searchParams={searchParams}
            />
        </Stack>
    );
}
