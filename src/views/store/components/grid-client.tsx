"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Box, Button, CircularProgress, Grid, Stack, Typography } from "@mui/material";
import ProductCard, { type ProductCardProps } from "@/components/product";
import AppPagination from "@/components/search/pagination";

const MAX_SCROLL_PAGE = 10;
const INITIAL_VISIBLE_COUNT = 8;
const VISIBLE_STEP = 8;
const REVEAL_INTERVAL_MS = 80;

type StoreProductGridClientProps = {
    initialProducts: ProductCardProps[];
    initialPage: number;
    totalPages: number;
    initialQueryString: string;
};

export default function StoreProductGridClient({
    initialProducts,
    initialPage,
    totalPages,
    initialQueryString,
}: StoreProductGridClientProps) {
    const [products, setProducts] = useState(initialProducts);
    const [currentPage, setCurrentPage] = useState(initialPage);
    const [visibleCount, setVisibleCount] = useState(Math.min(initialProducts.length, INITIAL_VISIBLE_COUNT));
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const sentinelRef = useRef<HTMLDivElement | null>(null);

    const maxScrollPage = Math.min(totalPages, MAX_SCROLL_PAGE);
    const canAutoLoadMore = currentPage < maxScrollPage;
    const revealInProgress = visibleCount < products.length;

    useEffect(() => {
        setProducts(initialProducts);
        setCurrentPage(initialPage);
        setVisibleCount(Math.min(initialProducts.length, INITIAL_VISIBLE_COUNT));
        setError(null);
    }, [initialProducts, initialPage, initialQueryString]);

    useEffect(() => {
        if (visibleCount >= products.length) {
            return;
        }
        const timer = window.setTimeout(() => {
            setVisibleCount((prev) => Math.min(products.length, prev + VISIBLE_STEP));
        }, REVEAL_INTERVAL_MS);

        return () => window.clearTimeout(timer);
    }, [visibleCount, products.length]);

    const fetchNextPage = useCallback(async () => {
        if (loading || !canAutoLoadMore || revealInProgress) {
            return;
        }
        const nextPage = currentPage + 1;
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams(initialQueryString);
            params.set("page", nextPage.toString());
            const response = await fetch(`/api/store/products?${params.toString()}`, {
                method: "GET",
                cache: "no-store",
            });
            if (!response.ok) {
                throw new Error("خطا در بارگذاری محصولات");
            }
            const payload = await response.json() as { products?: ProductCardProps[]; page?: number };
            const nextProducts = Array.isArray(payload.products) ? payload.products : [];
            if (nextProducts.length > 0) {
                setProducts((prev) => [...prev, ...nextProducts]);
            }
            setCurrentPage(payload.page ?? nextPage);
        } catch (err) {
            const message = err instanceof Error ? err.message : "خطا در برقراری ارتباط";
            setError(message);
        } finally {
            setLoading(false);
        }
    }, [loading, canAutoLoadMore, revealInProgress, currentPage, initialQueryString]);

    useEffect(() => {
        const canObserve = canAutoLoadMore && !revealInProgress;
        if (!canObserve) {
            return;
        }

        const observer = new IntersectionObserver(
            (entries) => {
                const [entry] = entries;
                if (entry?.isIntersecting) {
                    fetchNextPage();
                }
            },
            { rootMargin: "220px 0px" },
        );

        const target = sentinelRef.current;
        if (target) {
            observer.observe(target);
        }

        return () => {
            observer.disconnect();
        };
    }, [canAutoLoadMore, revealInProgress, fetchNextPage, products.length]);

    const showPagination = totalPages > 1 && currentPage >= maxScrollPage;
    const renderedProducts = products.slice(0, visibleCount);

    return <Stack spacing={4}>
        <Grid container spacing={2}>
            {renderedProducts.map((product) => (
                <Grid key={product.id} size={{ xs: 6, sm: 4, md: 3 }}>
                    <ProductCard {...product} />
                </Grid>
            ))}
        </Grid>

        {revealInProgress && (
            <Box sx={{ display: "flex", justifyContent: "center", py: 1 }}>
                <CircularProgress size={16} />
            </Box>
        )}

        {canAutoLoadMore && !revealInProgress && (
            <Box
                ref={sentinelRef}
                sx={{
                    minHeight: 56,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                {loading && <CircularProgress size={16} />}
                {!loading && error && (
                    <Stack spacing={1} alignItems="center">
                        <Typography variant="body2" color="error">
                            {error}
                        </Typography>
                        <Button size="small" variant="outlined" onClick={fetchNextPage}>
                            تلاش مجدد
                        </Button>
                    </Stack>
                )}
            </Box>
        )}

        {showPagination && (
            <Box sx={{ display: "flex", justifyContent: "center" }}>
                <AppPagination page={Math.min(currentPage, totalPages)} pages={totalPages} />
            </Box>
        )}
    </Stack>;
}
