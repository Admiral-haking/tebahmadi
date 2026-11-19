import { ProductSchema } from "@/catalog/models/Product";
import Orderly from "@/components/orderly";
import SearchBox from "@/components/search";
import { Get, PATCH } from "@/utils/fetch";
import { Box, Button, Chip, Container, LinearProgress, Pagination, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from "@mui/material";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { VariantsView } from "../../catalog/variants";
import { RefreshButton } from "@/components/refresh";
import { PageJumper } from "@/components/search/pagination";
import ZoomableImage from "@/components/zoomable-image";

interface BslVariants {
    _id: string;
    productId?: string;
    variantId?: string;
    barcode: string;
    bslVariantId: number;
    bslProductId: number;
    quantity: number;
    displayName: string;
    vendorId: string;
    sku: string;
    match: ProductSchema[];
}

export default function BslProducts({ vendorId }: { vendorId: string }) {
    const searchParams = useSearchParams();
    const [loading, setLoading] = useState(false);
    const q = searchParams?.get("q") ?? "";
    const [response, setResponse] = useState<{ items: BslVariants[], pages: number }>();
    const [page, setPage] = useState(1);
    const [tokenError, setTokenError] = useState(false);

    function handleLoadInventory() {
        setLoading(true);
        setTokenError(false);
        Get(`/api/basalaam/products?vendorId=${vendorId}&page=${page}&q=${q}`)
            .then(res => {
                setResponse(res);
            })
            .catch((err) => {
                console.error("Basalam products error:", err);
                if (err?.status === 401 || err?.message?.includes?.("توکن")) {
                    setTokenError(true);
                    toast.error("❌ توکن باسلام یافت نشد! لطفاً از صفحه اصلی باسلام روی دکمه 'ذخیره توکن' کلیک کنید.", { duration: 8000 });
                } else {
                    toast.error("خطا در بارگیری موجودی باسلام");
                }
            })
            .finally(() => setLoading(false));
    }

    useEffect(handleLoadInventory, [page, q]);

    return <Container maxWidth="lg" sx={{ my: 4 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 3 }}>
            <SearchBox onSearchUrl={`/admin/basalaam/${vendorId}?tab=2`} alwaysShowSearch initialQuery={q} preserveQueryParams />
            <RefreshButton onClick={handleLoadInventory} />
        </Stack>

        {loading && <LinearProgress />}

        {tokenError && (
            <Stack direction="row" gap={1} alignItems="center" sx={{ mb: 2, p: 2, bgcolor: 'rgba(var(--mui-palette-warning-mainChannel) / 0.12)', borderRadius: 1 }}>
                <Typography color="error" variant="body2">
                    ⚠️ توکن باسلام ثبت نشده یا منقضی شده است. برای استفاده از این بخش:
                </Typography>
                <Button
                    variant="contained"
                    color="warning"
                    size="small"
                    component={Link}
                    href={`/admin/basalaam`}
                >
                    رفتن به تنظیمات توکن
                </Button>
            </Stack>
        )}

        <TableContainer>
            <Table sx={{ minWidth: 1400 }}>
                <TableHead>
                    <TableRow>
                        <TableCell>#</TableCell>
                        <TableCell>کالا</TableCell>
                        <TableCell>موجودی</TableCell>
                        <TableCell>کد محصول</TableCell>
                        <TableCell></TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {response?.items.map((item, i) => <TableRow key={item._id}>
                        <TableCell>{(i + 1) + ((page - 1) * 50)}</TableCell>
                        <TableCell>
                            <Stack direction="row" alignItems="center" gap={1}>
                                <ZoomableImage
                                    src={item.match[0]?.variants[0]?.mediaIds?.[0] ? `/api/media/${item.match[0]?.variants[0]?.mediaIds?.[0]}` : undefined}
                                    width={40}
                                    height={40}
                                    alt={item.displayName}
                                />
                                <Stack>
                                    <Typography variant="body2" color="text.primary">
                                        {item.displayName}
                                    </Typography>
                                    {item.match.map(x => <Typography key={x.slug} color="text.secondary" variant="caption" component={Link} target="_blank" href={`/product/${x.slug}`}>
                                        {x.title},
                                    </Typography>)}
                                </Stack>
                            </Stack>
                        </TableCell>
                        <TableCell>
                            <Stack direction="row" gap={1}>
                                {item.match[0]?.variants.find(x => `${x._id}` === item.variantId)?.inventory.quantity === item.quantity ?
                                    <Chip label={item.quantity} color="success" /> :
                                    <>
                                        {item.match[0]?.variants.find(x => `${x._id}` === item.variantId) && <Chip label={`سایت: ${item.match[0]?.variants.find(x => `${x._id}` === item.variantId)?.inventory.quantity}`} color="default" />}
                                        <Chip label={`باسلام: ${item.quantity}`} color="warning" variant="outlined" />
                                    </>
                                }
                            </Stack>
                        </TableCell>
                        <TableCell>{item.sku || item.barcode || "N/A"}</TableCell>
                        <TableCell align="right">
                            {!item.match[0] && <Orderly
                                buttonProps={{ variant: "contained", color: "warning", size: "small", children: " اتصال به سایت" }}
                                mountChildrenOnOpen
                                hideFinish
                                title={`اتصال ${item.displayName}`}
                            >
                                <VariantsView
                                    search={item.displayName}
                                    onSelect={(v) => {
                                        const toastId = toast.loading(`در حال به روز رسانی ${v?.displayName || "واریانت"}...`);
                                        PATCH(`/api/basalaam`, { vendorId, product_id: item.bslProductId, variant_id: item.bslVariantId || 0, barcode: v.barcode || v.sku })
                                            .then(() => { toast.success("تنوع محصول به روز رسانی شد"); handleLoadInventory() })
                                            .catch(() => toast.error("خطا در بارگیری تنوع محصولات"))
                                            .finally(() => { setLoading(false); toast.dismiss(toastId); });
                                    }}
                                />
                            </Orderly>}
                        </TableCell>
                    </TableRow>)}
                </TableBody>
            </Table>
        </TableContainer>
        <Stack direction="row" alignItems="center" gap={2} flexWrap="wrap">
            <Pagination page={page} count={response?.pages} onChange={(_, n) => setPage(n)} />
            <PageJumper pages={response?.pages ?? 1} onJump={setPage} />
        </Stack>
    </Container>
}
