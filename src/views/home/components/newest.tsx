import { Container, Grid } from "@mui/material";
import { loadNewestProducts } from "@/lib/cache";
import ProductCard from "@/components/product";
import { SectionHeader } from "@/components/ui/SectionHeader";

export default async function NewestProducts({
    title = "جدیدترین محصولات طب احمدی",
    subtitle = "تازه‌ترین برداشت و بسته‌بندی گیاهان دارویی و فرآورده‌های طبیعی",
}: {
    title?: string;
    subtitle?: string;
}) {
    const result = await loadNewestProducts();
    const items = Array.isArray(result?.items) ? result.items.slice(0, 4) : [];
    if (items.length === 0) return null;

    return (
        <Container maxWidth="lg" sx={{ py: { xs: 3, md: 4.5 }, px: { xs: 1.5, sm: 2.5 } }}>
            <SectionHeader
                title={title}
                subtitle={subtitle}
                href="/store?sort=newest"
                ctaLabel="مشاهده همه"
            />

            <Grid container spacing={{ xs: 1.5, sm: 2, md: 2.5 }}>
                {items.map((item) => (
                    <Grid key={item.id} size={{ xs: 6, sm: 6, md: 3 }}>
                        <ProductCard {...item} />
                    </Grid>
                ))}
            </Grid>
        </Container>
    );
}
