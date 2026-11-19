"use client";

import {
    Box, CircularProgress, Container, Divider, InputBase,
    Pagination, Paper, Stack, Typography,
} from "@mui/material";
import SearchRounded from "@mui/icons-material/SearchRounded";
import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ProductSearchItem, loadProducts } from "./loaders";
import ProductSearchLink, { ProductSearchLinkPlaceholder } from "./components/product";

export default function SearchView() {
    const searchParams = useSearchParams();
    const router = useRouter();

    const q = searchParams?.get("q") || "";
    const [inputValue, setInputValue] = useState(q);
    const [loading, setLoading] = useState(false);
    const [products, setProducts] = useState<ProductSearchItem[]>([]);
    const [page, setPage] = useState(1);
    const [pages, setPages] = useState(1);
    const [total, setTotal] = useState(0);

    // Sync input when URL changes (back/forward navigation)
    useEffect(() => {
        setInputValue(q);
    }, [q]);

    // Debounce URL push so the page re-fetches only after the user pauses typing
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    function handleInput(value: string) {
        setInputValue(value);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            router.push(value.trim() ? `/search?q=${encodeURIComponent(value.trim())}` : '/search');
        }, 400);
    }

    // Fetch results; reset page to 1 whenever the query changes
    const prevQRef = useRef(q);
    useEffect(() => {
        let fetchPage = page;

        if (prevQRef.current !== q) {
            fetchPage = 1;
            prevQRef.current = q;
        }

        // If page needs resetting, update state and let this effect re-run with page=1
        if (fetchPage !== page) {
            setPage(fetchPage);
            return;
        }

        if (!q) {
            setProducts([]);
            setTotal(0);
            setPages(1);
            return;
        }

        setLoading(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        loadProducts(q, fetchPage)
            .then(result => {
                setProducts(result.products);
                setTotal(result.total);
                setPages(Math.ceil(result.total / 20));
            })
            .catch(() => toast.error("متاسفانه با خطایی غیر منتظره مواجه شدیم!"))
            .finally(() => setLoading(false));
    }, [q, page]);

    const showSkeletons = loading && products.length === 0;
    const showEmpty = !loading && products.length === 0 && !!q;
    const showInitial = !loading && products.length === 0 && !q;

    return (
        <Container maxWidth="md" sx={{ py: 3 }}>
            {/* Search bar */}
            <Paper
                elevation={0}
                sx={{
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 2,
                    p: 0.5,
                    mb: 2,
                }}
            >
                <Stack direction="row" alignItems="center" gap={1}>
                    {loading
                        ? <CircularProgress size={20} sx={{ mx: 1, flexShrink: 0, color: 'text.secondary' }} />
                        : <SearchRounded sx={{ color: 'text.secondary', mx: 1 }} />
                    }
                    <InputBase
                        fullWidth
                        placeholder="جستجو در کالاها..."
                        value={inputValue}
                        onChange={e => handleInput(e.target.value)}
                        sx={{ py: 0.75, fontSize: '1rem' }}
                        autoFocus
                        inputProps={{ autoComplete: 'off' }}
                    />
                </Stack>
            </Paper>

            {/* Result count */}
            {q && !loading && (
                <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                    {total > 0
                        ? `${new Intl.NumberFormat('fa-IR').format(total)} نتیجه برای «${q}»`
                        : `نتیجه‌ای برای «${q}» یافت نشد`
                    }
                </Typography>
            )}

            <Divider sx={{ my: 1 }} />

            {/* Results list */}
            <Stack gap={1.5} sx={{ my: 2 }}>
                {showSkeletons && (
                    new Array(8).fill(0).map((_, i) => <ProductSearchLinkPlaceholder key={i} />)
                )}
                {!showSkeletons && products.map(item => (
                    <ProductSearchLink key={item.id} {...item} />
                ))}
                {showEmpty && (
                    <Box sx={{ py: 8, textAlign: 'center' }}>
                        <Typography color="text.secondary">
                            نتیجه‌ای برای «{q}» یافت نشد
                        </Typography>
                    </Box>
                )}
                {showInitial && (
                    <Box sx={{ py: 8, textAlign: 'center' }}>
                        <Typography color="text.secondary">
                            نام کالا، برند یا مدل مورد نظر را جستجو کنید
                        </Typography>
                    </Box>
                )}
            </Stack>

            {/* Pagination */}
            {pages > 1 && !loading && (
                <>
                    <Divider />
                    <Stack alignItems="center" justifyContent="center" sx={{ mt: 2 }}>
                        <Pagination
                            page={page}
                            count={pages}
                            onChange={(_, p) => setPage(p)}
                        />
                    </Stack>
                </>
            )}
        </Container>
    );
}
