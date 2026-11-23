import Orderly from "@/components/orderly";
import { RefreshButton } from "@/components/refresh";
import { DgkProductsResponse } from "@/digikala/services/products";
import { Get } from "@/utils/fetch";
import {
  Box,
  Alert,
  Button,
  Checkbox,
  Chip,
  Container,
  LinearProgress,
  Pagination,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Skeleton,
} from "@mui/material";
import StorefrontRoundedIcon from "@mui/icons-material/StorefrontRounded";
import Link from "next/link";
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import Variant from "./variant";
import { CategoryListItem } from "../../catalog/categories";
import axios from "axios";
import CompareDgkVariants from "./compare-variants";
import BecomeSellerDialog from "./become-seller-dialog";
import BulkBecomeSellerDialog, { type BulkProduct } from "./bulk-become-seller-dialog";

const REQUEST_TIMEOUT_MS = 25_000;
const RETRY_DELAY_MS = 1_200;

let cachedDependencies:
  | {
      categories?: CategoryListItem[];
      types?: any[];
      expiresAt: number;
    }
  | undefined;

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getJsonWithRetry<T>(
  url: string,
  signal: AbortSignal,
  retries = 2,
): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, {
        credentials: "include",
        cache: "default",
        headers: { Accept: "application/json" },
        signal,
      });
      const contentType = response.headers.get("content-type") ?? "";
      const data = contentType.includes("application/json")
        ? await response.json()
        : await response.text();
      if (!response.ok) {
        throw new Error(
          typeof data === "string" ? data : data?.error || response.statusText,
        );
      }
      return data as T;
    } catch (error) {
      if (signal.aborted || attempt >= retries) throw error;
      await wait(RETRY_DELAY_MS * (attempt + 1));
    }
  }
  throw new Error("request_failed");
}

export default function ProductsDgk({ vendorId }: { vendorId: string }) {
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<DgkProductsResponse>();
  const [categories, setCategories] = useState<CategoryListItem[]>();
  const [types, setTypes] = useState<any[]>();
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [error, setError] = useState<string | null>(null);

  // When searching, the backend now searches locally in this vendor's products
  // (not globally across all Digikala). So we pass the search term to the API.
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const [eligibilityLoading, setEligibilityLoading] = useState(false);
  const [recentlyMatched, setRecentlyMatched] = useState<
    Record<number, number>
  >({});
  const requestSeqRef = useRef(0);

  // Bulk-transfer selection (product_id → title) and dialog visibility.
  const [selected, setSelected] = useState<Record<number, string>>({});
  const [bulkOpen, setBulkOpen] = useState(false);

  const attachEligibility = useCallback(
    async (next: DgkProductsResponse) => {
      const items = Array.isArray(next?.data?.items) ? next.data.items : [];
      const productIds = items
        .map((item) => Number(item.product_id))
        .filter((id) => Number.isFinite(id) && id > 0);

      if (!productIds.length) return next;

      setEligibilityLoading(true);
      try {
        const eligibilityItems = await getJsonWithRetry<{
          items?: Record<string, unknown>;
        }>(
          `/api/digikala/products/eligibility?vendorId=${encodeURIComponent(vendorId)}&productIds=${productIds.join(",")}`,
          AbortSignal.timeout(REQUEST_TIMEOUT_MS),
          1,
        ).then((res) => res?.items ?? {});

        return {
          ...next,
          data: {
            ...next.data,
            items: items.map((item) => ({
              ...item,
              importEligibility:
                eligibilityItems[String(item.product_id)] ??
                item.importEligibility ??
                null,
            })),
          },
        } as DgkProductsResponse;
      } catch {
        toast.warning(
          "جزئیات موجودی/فعال بودن بعضی کالاهای دیجی‌کالا دریافت نشد.",
        );
        return next;
      } finally {
        setEligibilityLoading(false);
      }
    },
    [vendorId],
  );

  const markRecentlyMatched = useCallback(
    (previous: DgkProductsResponse | undefined, items: any[]) => {
      if (!previous?.data?.items?.length) return;
      const prevMap = new Map<number, boolean>();
      previous.data.items.forEach((item) => {
        prevMap.set(Number(item.product_id), Boolean(item.isMatch));
      });

      const newMarks: Record<number, number> = {};
      items.forEach((item) => {
        const productId = Number(item.product_id);
        if (!Number.isFinite(productId)) return;
        if (item.isMatch && !prevMap.get(productId)) {
          newMarks[productId] = Date.now() + 30_000;
        }
      });

      if (Object.keys(newMarks).length) {
        setRecentlyMatched((prev) => ({ ...prev, ...newMarks }));
      }
    },
    [],
  );

  const handleLoadProducts = useCallback(async () => {
    const requestSeq = requestSeqRef.current + 1;
    requestSeqRef.current = requestSeq;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    setLoading(true);
    setError(null);

    try {
      const serverQuery = deferredQuery.trim();
      const params = new URLSearchParams({
        vendorId,
        page: String(page),
      });
      if (serverQuery) {
        params.set("q", serverQuery);
      }

      const res = await getJsonWithRetry<DgkProductsResponse>(
        `/api/digikala/products?${params.toString()}`,
        controller.signal,
      );
      if (requestSeqRef.current !== requestSeq) return;
      const baseItems = Array.isArray(res?.data?.items) ? res.data.items : [];

      setResponse((previous) => {
        markRecentlyMatched(previous, baseItems);
        return res;
      });
      setLastUpdatedAt(Date.now());
      setLoading(false);

      const next = await attachEligibility(res);
      if (requestSeqRef.current !== requestSeq) return;
      setResponse((current) => {
        if (!current || current !== res) return current;
        return next;
      });
    } catch (error) {
      if (!controller.signal.aborted) {
        setError("خطا در بارگیری کالاهای دیجی‌کالا");
        toast.error("خطا در بارگیری کالاهای دیجی‌کالا");
      } else {
        setError("دریافت کالاهای دیجی‌کالا طولانی شد؛ دوباره تلاش کنید.");
        toast.warning("دریافت کالاهای دیجی‌کالا طولانی شد؛ دوباره تلاش کنید.");
      }
      setLoading(false);
    } finally {
      window.clearTimeout(timeout);
    }
  }, [attachEligibility, markRecentlyMatched, vendorId, page, deferredQuery]);

  const handleLoadDependencies = useCallback(async () => {
    const now = Date.now();
    if (cachedDependencies && cachedDependencies.expiresAt > now) {
      setCategories(cachedDependencies.categories);
      setTypes(cachedDependencies.types);
      return;
    }

    try {
      const [categoriesRes, typesRes] = await Promise.all([
        axios.get("/api/admin/catalog/categories"),
        axios.get("/api/catalog/product-types"),
      ]);
      const next = {
        categories: categoriesRes.data.categories,
        types: typesRes.data.productTypes,
        expiresAt: now + 5 * 60 * 1000,
      };
      cachedDependencies = next;
      setCategories(next.categories);
      setTypes(next.types);
    } catch {
      toast.error("خطا در بارگیری دسته‌بندی‌ها یا انواع کالا");
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    await handleLoadProducts();
  }, [handleLoadProducts]);

  useEffect(() => {
    void handleLoadProducts();
  }, [handleLoadProducts]);

  useEffect(() => {
    handleLoadDependencies();
  }, [handleLoadDependencies]);

  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      setRecentlyMatched((prev) => {
        const next: Record<number, number> = {};
        Object.entries(prev).forEach(([key, until]) => {
          if (until > now) next[Number(key)] = until;
        });
        return next;
      });
    }, 5_000);
    return () => clearInterval(timer);
  }, []);

  const displayedItems = response?.data?.items ?? [];

  const selectableIds = displayedItems
    .map((it) => Number(it.product_id))
    .filter((id) => Number.isFinite(id) && id > 0);
  const selectedIds = Object.keys(selected).map(Number);
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selected[id]);
  const someSelected = selectableIds.some((id) => selected[id]);

  function toggleOne(id: number, title: string, checked: boolean) {
    setSelected((prev) => {
      const next = { ...prev };
      if (checked) next[id] = title;
      else delete next[id];
      return next;
    });
  }

  function toggleAll(checked: boolean) {
    setSelected((prev) => {
      const next = { ...prev };
      for (const it of displayedItems) {
        const id = Number(it.product_id);
        if (!Number.isFinite(id) || id <= 0) continue;
        if (checked) next[id] = String(it.title ?? `کالا ${id}`);
        else delete next[id];
      }
      return next;
    });
  }

  const bulkProducts: BulkProduct[] = selectedIds.map((id) => ({ product_id: id, title: selected[id] }));
  const isLocalFallback = (response as (DgkProductsResponse & { meta?: { source?: string } }) | undefined)?.meta?.source === "local";

  return (
    <Container maxWidth={false} sx={{ my: 4, px: { xs: 1, md: 3 } }}>
      {(loading || eligibilityLoading) && <LinearProgress />}
      {isLocalFallback ? (
        <Alert severity="warning" sx={{ mb: 1.5 }}>
          اتصال مستقیم به دیجی‌کالا ناموفق بود؛ فعلاً کالاهای ذخیره‌شده‌ی محلی نمایش داده می‌شوند.
        </Alert>
      ) : null}
      {error ? (
        <Alert
          severity="error"
          sx={{ mb: 1.5 }}
          action={
            <Button color="inherit" size="small" disabled={loading} onClick={() => void handleLoadProducts()}>
              تلاش دوباره
            </Button>
          }
        >
          {error}
        </Alert>
      ) : null}
      {loading && !response ? (
        <Stack spacing={1.25} sx={{ mt: 2 }}>
          {Array.from({ length: 8 }).map((_, index) => (
            <Stack
              key={index}
              direction="row"
              gap={1.5}
              alignItems="center"
              sx={{
                p: 1.25,
                border: 1,
                borderColor: "divider",
                borderRadius: 1,
              }}
            >
              <Skeleton variant="rounded" width={64} height={64} />
              <Stack flex={1} spacing={0.75}>
                <Skeleton variant="text" width="55%" />
                <Skeleton variant="text" width="35%" />
              </Stack>
              <Skeleton variant="rounded" width={128} height={32} />
            </Stack>
          ))}
        </Stack>
      ) : null}

      <Stack
        direction={{ xs: "column", md: "row" }}
        gap={1.5}
        alignItems={{ xs: "stretch", md: "center" }}
        sx={{ mb: 1.5 }}
      >
        <TextField
          value={query}
          onChange={(event) => {
            setPage(1);
            setQuery(event.target.value);
          }}
          fullWidth
          size="small"
          placeholder="جستجو در کالاهای این صفحه: کد کالا، عنوان، برند..."
        />
        <Stack direction="row" alignItems="center" gap={1}>
          {selectedIds.length > 0 && (
            <Button
              variant="contained"
              size="small"
              startIcon={<StorefrontRoundedIcon fontSize="small" />}
              onClick={() => setBulkOpen(true)}
            >
              انتقال {selectedIds.length.toLocaleString("fa-IR")} محصول
            </Button>
          )}
          <RefreshButton onClick={() => void handleRefresh()} />
          {lastUpdatedAt && (
            <Typography variant="caption" color="text.secondary">
              بروزرسانی:{" "}
              {new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              }).format(new Date(lastUpdatedAt))}
            </Typography>
          )}
        </Stack>
      </Stack>

      <TableContainer
        sx={{
          width: "100%",
          overflowX: "auto",
          border: 1,
          borderColor: "divider",
          borderRadius: 1,
          display: loading && !response ? "none" : "block",
        }}
      >
        <Table
          sx={{
            minWidth: 980,
            width: "100%",
            tableLayout: "fixed",
            "& th, & td": {
              whiteSpace: "normal",
              overflowWrap: "anywhere",
              wordBreak: "break-word",
              verticalAlign: "top",
            },
          }}
        >
          <TableHead>
            <TableRow>
              <TableCell width={48} padding="checkbox">
                <Checkbox
                  size="small"
                  checked={allSelected}
                  indeterminate={!allSelected && someSelected}
                  onChange={(e) => toggleAll(e.target.checked)}
                />
              </TableCell>
              <TableCell width={48}>#</TableCell>
              <TableCell width="38%">کالا</TableCell>
              <TableCell width="22%">وضعیت افزودن</TableCell>
              <TableCell width="18%">واریانت‌ها</TableCell>
              <TableCell width={150} align="right">
                عملیات
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {displayedItems.map((item, i) => {
              const productId = Number(item.product_id);
              const isRecentlyMatched =
                Number.isFinite(productId) &&
                (recentlyMatched[productId] ?? 0) > Date.now();
              const hasVariantCount = Number(item.variants_count ?? 0) > 0;
              const eligibility = item.importEligibility;
              const totalVariants = Number(
                eligibility?.totalVariants ?? item.variants_count ?? 0,
              );
              const activeCount = Number(eligibility?.activeVariantCount ?? 0);
              const activeInStockCount = Number(
                eligibility?.activeInStockVariantCount ?? 0,
              );
              const inactiveCount = Number(
                eligibility?.inactiveVariantCount ?? 0,
              );
              const zeroStockCount = Number(
                eligibility?.zeroStockVariantCount ?? 0,
              );
              const canOpenImport = hasVariantCount || totalVariants > 0;
              const importBlocked = !canOpenImport;

              return (
                <TableRow key={item.product_id} selected={Boolean(selected[productId])}>
                  <TableCell padding="checkbox">
                    {Number.isFinite(productId) && productId > 0 && (
                      <Checkbox
                        size="small"
                        checked={Boolean(selected[productId])}
                        onChange={(e) =>
                          toggleOne(productId, String(item.title ?? `کالا ${productId}`), e.target.checked)
                        }
                      />
                    )}
                  </TableCell>
                  <TableCell>{i + 1 + (page - 1) * 50}</TableCell>
                  <TableCell>
                    <Stack direction="row" alignItems="center" gap={1}>
                      <Box
                        component="img"
                        src={item.image_src}
                        loading="lazy"
                        width={56}
                        height={56}
                        alt={item.title}
                        sx={{ borderRadius: 0.6 }}
                      />
                      <Stack spacing={0.25}>
                        <Typography
                          variant="body2"
                          color="text.primary"
                          component={Link}
                          target="_blank"
                          href={item.product_url}
                        >
                          {item.title}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          کد دیجی‌کالا: {item.product_id}
                        </Typography>
                        {item.matchedProduct && (
                          <Typography variant="caption" color="text.secondary">
                            سایت: {item.matchedProduct.title} (
                            {item.matchedProduct.slug})
                          </Typography>
                        )}
                      </Stack>
                    </Stack>
                  </TableCell>

                  <TableCell>
                    <Stack
                      direction="row"
                      alignItems="center"
                      gap={1}
                      flexWrap="wrap"
                    >
                      <Chip
                        color={canOpenImport ? "info" : "error"}
                        variant={canOpenImport ? "outlined" : "filled"}
                        label={
                          canOpenImport ? "قابل ورود/بررسی" : "واریانت ندارد"
                        }
                      />
                      {canOpenImport ? (
                        <>
                          {eligibility ? (
                            <>
                              <Chip
                                color={
                                  activeInStockCount > 0 ? "success" : "warning"
                                }
                                variant="outlined"
                                label={`موجود: ${activeInStockCount.toLocaleString("fa-IR")}`}
                              />
                              <Chip
                                color={
                                  inactiveCount > 0 ? "warning" : "default"
                                }
                                variant="outlined"
                                label={`غیرفعال: ${inactiveCount.toLocaleString("fa-IR")}`}
                              />
                              <Chip
                                color={zeroStockCount > 0 ? "error" : "default"}
                                variant="outlined"
                                label={`ناموجود: ${zeroStockCount.toLocaleString("fa-IR")}`}
                              />
                            </>
                          ) : (
                            <Chip
                              size="small"
                              variant="outlined"
                              label="در حال بررسی واریانت‌ها"
                            />
                          )}
                          {eligibility?.reason ? (
                            <Chip
                              color="warning"
                              variant="filled"
                              label={eligibility.reason}
                            />
                          ) : null}
                        </>
                      ) : null}
                    </Stack>
                  </TableCell>

                  <TableCell>
                    <Stack
                      direction="row"
                      alignItems="center"
                      gap={1}
                      flexWrap="wrap"
                    >
                      <Chip
                        color={item.active ? "success" : "error"}
                        label={item.active ? "فعال" : "غیرفعال"}
                      />
                      <Chip
                        color={item.variants_count ? "default" : "error"}
                        label={`واریانت: ${totalVariants || item.variants_count}`}
                      />
                      <Chip
                        color={item.isMatch ? "success" : "warning"}
                        variant={item.isMatch ? "filled" : "outlined"}
                        label={item.isMatch ? "در سایت" : "ثبت نشده"}
                      />
                      {isRecentlyMatched && (
                        <Chip color="info" size="small" label="الان سینک شد" />
                      )}
                    </Stack>
                  </TableCell>
                  <TableCell align="right">
                    <Stack alignItems="flex-end" gap={0.75}>
                      {!item.isMatch ? (
                        <Orderly
                          buttonProps={{
                            children: "وارد کردن",
                            variant: "contained",
                            disabled: importBlocked,
                          }}
                          title={`جزئیات ${item.title}`}
                          hideFinish
                          mountChildrenOnOpen
                        >
                          <Variant
                            product_id={item.product_id}
                            vendorId={vendorId}
                            product={JSON.stringify(item)}
                            categories={categories}
                            types={types}
                          />
                        </Orderly>
                      ) : (
                        <CompareDgkVariants
                          vendorId={vendorId}
                          productId={item.product_id}
                          product={JSON.stringify(item)}
                          productTitle={item.title}
                          categories={categories}
                          types={types}
                          onImported={() => handleLoadProducts()}
                        />
                      )}
                      <BecomeSellerDialog
                        productId={item.product_id}
                        productTitle={item.title}
                        sourceVendorId={vendorId}
                      />
                    </Stack>
                  </TableCell>
                </TableRow>
              );
            })}
            {!displayedItems.length && (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  <Stack alignItems="center" spacing={1} sx={{ py: 4 }}>
                    <Typography variant="subtitle2" color="text.primary">
                      نتیجه‌ای برای نمایش پیدا نشد.
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      عبارت جستجو را ساده‌تر کنید یا با دکمه بروزرسانی دوباره از دیجی‌کالا بخوانید.
                    </Typography>
                    <Button variant="outlined" disabled={loading} onClick={() => void handleLoadProducts()}>
                      تلاش دوباره
                    </Button>
                  </Stack>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      <Stack direction={{ xs: "column", sm: "row" }} alignItems="center" justifyContent="space-between" gap={1.5} sx={{ mt: 2 }}>
        <Typography variant="caption" color="text.secondary">
          جستجوی این تب از API دیجی‌کالا انجام می‌شود و بین همه کالاهای فروشنده می‌گردد.
        </Typography>
        <Pagination
          page={page}
          count={Math.max(1, Number(response?.data.pager.total_pages ?? 1))}
          siblingCount={1}
          boundaryCount={1}
          onChange={(_, n) => {
            setPage(n);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        />
      </Stack>

      <BulkBecomeSellerDialog
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        products={bulkProducts}
        sourceVendorId={vendorId}
      />
    </Container>
  );
}
