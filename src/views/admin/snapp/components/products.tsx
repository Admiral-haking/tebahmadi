import { Get } from "@/utils/fetch";
import { Box, Chip, Container, LinearProgress, Pagination, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from "@mui/material";
import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { RefreshButton } from "@/components/refresh";
import { SnappProductsResponse } from "@/snapp/api/type";
import ListFilterBar from "@/components/admin/list-filter-bar";
import { PageJumper } from "@/components/search/pagination";
import ZoomableImage from "@/components/zoomable-image";


export default function SnappProducts({ vendorId, snpVendorId }: { vendorId: string, snpVendorId: string }) {

    const [loading, setLoading] = useState(false);


    const [response, setResponse] = useState<SnappProductsResponse>();

    const [page, setPage] = useState(1)
    const [query, setQuery] = useState("");
    const deferredQuery = useDeferredValue(query);
    const [facets, setFacets] = useState<Record<string, string[]>>({ diff: [], match: [] });

    function handleLoadInventory() {
        setLoading(true)
        Get(`/api/snapp/${vendorId}/${snpVendorId}/products?page=${page}`)
            .then(res => {
                setResponse(res);
            })
            .catch(() => toast.error("خطا در بارگیری موجودی اسنپ"))
            .finally(() => setLoading(false));
    }

    useEffect(handleLoadInventory, [page]);

    const filtered = useMemo(() => {
        const items = response?.data ?? [];
        const term = deferredQuery.trim().toLowerCase();
        const { diff = [], match = [] } = facets;
        return items.filter((item) => {
            if (term && ![item.title, item.sku, item.match?.title].some((v) => String(v ?? "").toLowerCase().includes(term))) return false;
            const siteQty = item.match?.variants?.find((x) => `${x.barcode}` === item.sku)?.inventory?.quantity;
            if (diff.length) {
                const isMismatch = siteQty != null && siteQty !== item.stock;
                const ok = diff.some((d) => (d === "mismatch" ? isMismatch : !isMismatch));
                if (!ok) return false;
            }
            if (match.length) {
                const matched = Boolean(item.match);
                const ok = match.some((m) => (m === "matched" ? matched : !matched));
                if (!ok) return false;
            }
            return true;
        });
    }, [deferredQuery, response?.data, facets]);

    return <Container maxWidth="lg" sx={{ my: 4 }}>

        <ListFilterBar
            search={query}
            onSearchChange={setQuery}
            searchPlaceholder="فیلتر: عنوان، کد محصول، نام کالای سایت..."
            resultCount={filtered.length}
            onClear={() => { setQuery(""); setFacets({ diff: [], match: [] }); }}
            onFacetChange={(key, values) => setFacets((p) => ({ ...p, [key]: values }))}
            right={<RefreshButton onClick={handleLoadInventory} />}
            facets={[
                { key: "diff", label: "تطبیق موجودی", value: facets.diff, options: [
                    { value: "mismatch", label: "مغایر با سایت" }, { value: "equal", label: "برابر" },
                ] },
                { key: "match", label: "اتصال سایت", value: facets.match, options: [
                    { value: "matched", label: "متصل به سایت" }, { value: "unmatched", label: "بدون اتصال" },
                ] },
            ]}
        />

        {loading && <LinearProgress />}

        <TableContainer>
            <Table sx={{ minWidth: 1200 }}>
                <TableHead>
                    <TableRow>
                        <TableCell>#</TableCell>
                        <TableCell>کالا</TableCell>
                        <TableCell>موجودی</TableCell>
                        <TableCell>کد محصول</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {
                        filtered.map((item, i) => <TableRow key={item.id}>
                            <TableCell>{(i + 1) + ((page - 1) * 50)}</TableCell>
                            <TableCell>
                                <Stack direction="row" alignItems="center" gap={1}>
                                    <ZoomableImage
                                        src={item.thumbnail ? item.thumbnail : item.match?.variants?.[0]?.mediaIds?.[0] ? `/api/media/${item.match?.variants?.[0]?.mediaIds?.[0]}` : undefined}
                                        width={40}
                                        height={40}
                                        alt={item.title}
                                    />
                                    <Stack>
                                        <Typography variant="body2" color="text.primary">
                                            {item.title}
                                        </Typography>
                                        {
                                            item.match && <Typography key={item.match.slug} color="text.secondary" variant="caption" component={Link} target="_blank" href={`/product/${item.match.slug}`}>
                                                {item.match.title} ,
                                            </Typography>
                                        }
                                    </Stack>
                                </Stack>
                            </TableCell>

                            <TableCell>
                                <Stack direction="row" gap={1}>
                                    {
                                        item.match?.variants.find(x => `${x.barcode}` === item.sku)?.inventory.quantity === item.stock ?
                                            <Chip
                                                label={item.stock}
                                                color="success"
                                            /> :

                                            <>
                                                {item.match?.variants.find(x => `${x.barcode}` === item.sku) && <Chip
                                                    label={`سایت: ${item.match?.variants.find(x => `${x.barcode}` === item.sku)?.inventory.quantity}`}
                                                    color="default"
                                                />}
                                                <Chip
                                                    label={`اسنپ: ${item.stock}`}
                                                    color="warning"
                                                    variant="outlined"
                                                />
                                            </>
                                    }
                                </Stack>
                            </TableCell>
                            <TableCell>
                                {item.sku || "N/A"}
                            </TableCell>
                        </TableRow>)
                    }
                </TableBody>
            </Table>
        </TableContainer>
        <Stack direction="row" alignItems="center" gap={2} flexWrap="wrap">
            <Pagination
                page={page}
                count={response?.meta.pagination.total_pages}
                onChange={(_, n) => setPage(n)}
            />
            <PageJumper pages={response?.meta.pagination.total_pages ?? 1} onJump={setPage} />
        </Stack>
    </Container>
}