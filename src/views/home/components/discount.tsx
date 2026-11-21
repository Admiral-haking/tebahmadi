import { Box, Container, Grid } from "@mui/material";
import { loadDiscountProducts } from "@/lib/cache";
import ProductCard from "@/components/product";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { TEB_COLORS, TEB_RADII } from "@/theme/tokens";

export default async function DiscountProducts({
    title = "پیشنهادهای تخفیف‌دار طب احمدی",
    subtitle = "محصولات منتخب طبیعی با تخفیف ویژه فصل",
}: {
    title?: string;
    subtitle?: string;
}) {
    const result = await loadDiscountProducts();
    const items = Array.isArray(result?.items) ? result.items.slice(0, 4) : [];
    if (items.length === 0) return null;

    return (
        <Container maxWidth="lg" sx={{ py: { xs: 2.5, md: 3.5 }, px: { xs: 1.5, sm: 2.5 } }}>
            <Box
                sx={{
                    p: { xs: 2, sm: 3, md: 4 },
                    borderRadius: { xs: `${TEB_RADII.lg}px`, md: `${TEB_RADII.panel}px` },
                    bgcolor: TEB_COLORS.softSurface,
                    border: `1px solid ${TEB_COLORS.border}`,
                }}
            >
                <SectionHeader
                    title={title}
                    subtitle={subtitle}
                    href="/store?discount=1"
                    ctaLabel="مشاهده همه تخفیف‌ها"
                />

                <Grid container spacing={{ xs: 1.5, sm: 2, md: 2.5 }}>
                    {items.map((item) => (
                        <Grid key={item.id} size={{ xs: 6, sm: 6, md: 3 }}>
                            <ProductCard {...item} />
                        </Grid>
                    ))}
                </Grid>
            </Box>
        </Container>
    );
}
