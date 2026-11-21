"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Box, Container, Grid, Pagination, Stack, Typography } from "@mui/material";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { type ProductSearchItem, loadProducts } from "./loaders";
import ProductCard from "@/components/product";
import { SearchField } from "@/components/ui/SearchField";
import { EmptyState, LoadingState } from "@/components/ui/States";
import { TEB_COLORS, TEB_RADII } from "@/theme/tokens";
import { formatFaNumber } from "@/lib/format";

export default function SearchView() {
    const searchParams = useSearchParams();
    const router = useRouter();

    const q = searchParams?.get("q") || "";
    const [loading, setLoading] = useState(false);
    const [products, setProducts] = useState<ProductSearchItem[]>([]);
    const [page, setPage] = useState(1);
    const [pages, setPages] = useState(1);
    const [total, setTotal] = useState(0);

    useEffect(() => {
        setPage(1);
    }, [q]);

    useEffect(() => {
        if (!q.trim()) {
            setProducts([]);
            setTotal(0);
            setPages(1);
            return;
        }
        let cancelled = false;
        setLoading(true);
        loadProducts(q, page)
            .then((result) => {
                if (cancelled) return;
                setProducts(result.products);
                setTotal(result.total);
                setPages(Math.max(1, Math.ceil(result.total / 20)));
            })
            .catch(() => {
                if (!cancelled) {
                    toast.error("در دریافت نتایج جست‌وجو خطایی رخ داد.");
                }
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [q, page]);

    const pushQuery = (value: string) => {
        const trimmed = value.trim();
        if (trimmed === q) return;
        router.push(trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : "/search");
    };

    return (
        <Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 }, px: { xs: 1.5, sm: 2.5 } }}>
            <Box
                sx={{
                    p: { xs: 2.5, md: 3.5 },
                    mb: 3,
                    borderRadius: `${TEB_RADII.lg}px`,
                    bgcolor: TEB_COLORS.softSurface,
                    border: `1px solid ${TEB_COLORS.border}`,
                }}
            >
                <Typography variant="h3" fontWeight={800} sx={{ mb: 1.5, fontSize: { xs: "20px", md: "26px" } }}>
                    جست‌وجو در فروشگاه طب احمدی
                </Typography>
                <SearchField
                    defaultValue={q}
                    placeholder="نام گیاه دارویی، دمنوش، روغن یا عسل مورد نظر را وارد کنید..."
                    debounceMs={400}
                    onDebouncedChange={pushQuery}
                    onSubmit={pushQuery}
                />
                {q && !loading && (
                    <Typography variant="caption" sx={{ display: "block", mt: 1.5, color: TEB_COLORS.textSecondary, fontWeight: 600 }}>
                        {total > 0
                            ? `${formatFaNumber(total)} نتیجه برای «${q}» یافت شد`
                            : `نتیجه‌ای برای «${q}» پیدا نشد`}
                    </Typography>
                )}
            </Box>

            {loading ? (
                <LoadingState rows={4} height={96} />
            ) : products.length > 0 ? (
                <Stack spacing={4}>
                    <Grid container spacing={{ xs: 1.5, sm: 2, md: 2.5 }}>
                        {products.map((item) => (
                            <Grid key={item.id} size={{ xs: 6, sm: 4, md: 3 }}>
                                <ProductCard
                                    id={item.id}
                                    slug={item.slug}
                                    title={item.title}
                                    variantSubtitle={item.productTypeName}
                                    finalPrice={item.minPrice ?? 0}
                                    inStock={item.inventoryTotal > 0}
                                    stockCount={item.inventoryTotal}
                                    imageUrl={item.images?.[0]}
                                />
                            </Grid>
                        ))}
                    </Grid>

                    {pages > 1 && (
                        <Stack alignItems="center">
                            <Pagination page={page} count={pages} onChange={(_, p) => setPage(p)} />
                        </Stack>
                    )}
                </Stack>
            ) : q ? (
                <EmptyState
                    icon={<Search size={26} />}
                    title={`نتیجه‌ای برای «${q}» پیدا نشد`}
                    description="عبارت دیگری را امتحان کنید یا از دسته‌بندی‌های فروشگاه طب احمدی دیدن کنید."
                    actionLabel="مشاهده همه محصولات"
                    actionHref="/store"
                />
            ) : (
                <EmptyState
                    icon={<Search size={26} />}
                    title="چه محصول طبیعی نیاز دارید؟"
                    description="نام دمنوش، گیاه دارویی، روغن گیاهی یا عسل کوهستان را جست‌وجو کنید."
                    actionLabel="ورود به فروشگاه"
                    actionHref="/store"
                />
            )}
        </Container>
    );
}
