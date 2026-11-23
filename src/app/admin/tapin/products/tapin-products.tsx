'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  CardContent,
  Checkbox,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { toast } from 'sonner';
import { axiosRequest, safeJson } from '@/utils/axios-request';

type Product = {
  product_id: number;
  title: string;
  category_id: string;
  weight: number;
  price: number;
  description?: string | null;
  created_at?: string;
};
type Category = { category_id: string; title: string };
type Shop = { id: string; title: string };
type CatalogRow = {
  variantId: string;
  title: string;
  sku: string;
  price: number;
  weight?: number;
  tapinProductId?: number;
  tapinCategoryId?: string;
  tapinMappings?: Array<{ shopId: string; productId: number; categoryId: string }>;
};
const empty = { title: '', category_id: '', weight: 100, priceToman: 0, description: '' };

function useTapinProductsView() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [shopId, setShopId] = useState('');
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<Product | null | undefined>(undefined);
  const [form, setForm] = useState(empty);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [catalogRows, setCatalogRows] = useState<CatalogRow[]>([]);
  const [catalogQuery, setCatalogQuery] = useState('');
  const [selectedVariants, setSelectedVariants] = useState<string[]>([]);
  const [syncCategory, setSyncCategory] = useState('');
  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page) });
    if (shopId) params.set('shopId', shopId);
    if (appliedQuery) params.set(/^\d+$/.test(appliedQuery) ? 'productId' : 'title', appliedQuery);
    const response = await axiosRequest(`/api/admin/tapin/products?${params}`, {
      credentials: 'include',
      cache: 'no-store',
    });
    const result = await safeJson<{
      data?: {
        products: { list: Product[]; total_count: number };
        categories: Category[];
        shops: Shop[];
      };
    }>(response);
    if (!response.ok || result.error || !result.data)
      setError(result.error || 'دریافت محصولات ناموفق بود.');
    else {
      setProducts(result.data.products.list);
      setTotal(result.data.products.total_count);
      setCategories(result.data.categories);
      setShops(result.data.shops);
      setError('');
    }
    setLoading(false);
  }, [page, appliedQuery, shopId]);
  useEffect(() => {
    void load();
  }, [load]);
  const open = (product?: Product) => {
    setEditing(product ?? null);
    setForm(
      product
        ? {
            title: product.title,
            category_id: product.category_id,
            weight: product.weight,
            priceToman: Math.round(product.price / 10),
            description: product.description ?? '',
          }
        : { ...empty, category_id: categories[0]?.category_id ?? '' },
    );
  };
  const save = async () => {
    const body = {
      title: form.title,
      category_id: form.category_id,
      weight: Number(form.weight),
      price: Math.round(Number(form.priceToman) * 10),
      description: form.description || null,
    };
    const suffix = shopId ? `?shopId=${encodeURIComponent(shopId)}` : '';
    const url = editing
      ? `/api/admin/tapin/products/${editing.product_id}${suffix}`
      : `/api/admin/tapin/products${suffix}`;
    setLoading(true);
    const response = await axiosRequest(url, {
      method: editing ? 'PATCH' : 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const result = await safeJson(response);
    if (!response.ok || result.error)
      toast.error(typeof result.error === 'string' ? result.error : 'ذخیره محصول ناموفق بود.');
    else {
      toast.success(editing ? 'محصول ویرایش شد.' : 'محصول ساخته شد.');
      setEditing(undefined);
      await load();
    }
    setLoading(false);
  };
  const remove = async (product: Product) => {
    if (!window.confirm(`محصول «${product.title}» از تاپین حذف شود؟`)) return;
    const suffix = shopId ? `?shopId=${encodeURIComponent(shopId)}` : '';
    const response = await axiosRequest(
      `/api/admin/tapin/products/${product.product_id}${suffix}`,
      {
        method: 'DELETE',
        credentials: 'include',
      },
    );
    if (!response.ok) toast.error('حذف محصول ناموفق بود.');
    else {
      toast.success('محصول حذف شد.');
      await load();
    }
  };
  const loadCatalog = async () => {
    setLoading(true);
    const response = await axiosRequest(
      `/api/admin/tapin/products/catalog-sync?q=${encodeURIComponent(catalogQuery)}${shopId ? `&shopId=${encodeURIComponent(shopId)}` : ''}`,
      { credentials: 'include', cache: 'no-store' },
    );
    const result = await safeJson<{ data?: CatalogRow[] }>(response);
    if (!response.ok || result.error || !result.data)
      toast.error(result.error || 'دریافت کاتالوگ ناموفق بود.');
    else {
      setCatalogRows(result.data);
      setCatalogOpen(true);
      if (!syncCategory) setSyncCategory(categories[0]?.category_id ?? '');
    }
    setLoading(false);
  };
  const syncCatalog = async () => {
    setLoading(true);
    const response = await axiosRequest('/api/admin/tapin/products/catalog-sync', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        variantIds: selectedVariants,
        categoryId: syncCategory,
        shopId: shopId || undefined,
      }),
    });
    const result = await safeJson<{
      data?: { succeeded: number; results: Array<{ ok: boolean; error?: string }> };
    }>(response);
    if (!response.ok || result.error) toast.error(result.error || 'همگام‌سازی ناموفق بود.');
    else {
      const failed = result.data?.results.filter((item) => !item.ok) ?? [];
      toast.success(
        `${result.data?.succeeded ?? 0} واریانت همگام شد${failed.length ? `؛ ${failed.length} خطا` : ''}.`,
      );
      setSelectedVariants([]);
      await loadCatalog();
      await load();
    }
    setLoading(false);
  };
  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      <Stack spacing={2}>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={1}>
          <Typography variant="h4">محصولات تاپین</Typography>
          <Stack direction="row" gap={1}>
            <Button variant="outlined" onClick={() => void loadCatalog()}>
              همگام‌سازی کاتالوگ
            </Button>
            <Button variant="contained" onClick={() => open()}>
              محصول جدید
            </Button>
          </Stack>
        </Stack>
        {error ? <Alert severity="error">{error}</Alert> : null}
        <TextField
          select
          size="small"
          label="فروشگاه"
          value={shopId}
          onChange={(event) => {
            setShopId(event.target.value);
            setPage(1);
          }}
          sx={{ maxWidth: 320 }}
        >
          <MenuItem value="">فروشگاه پیش‌فرض</MenuItem>
          {shops.map((shop) => (
            <MenuItem key={shop.id} value={shop.id}>
              {shop.title}
            </MenuItem>
          ))}
        </TextField>
        <Card variant="outlined">
          <CardContent>
            <Stack direction="row" gap={1}>
              <TextField
                size="small"
                fullWidth
                label="نام یا شناسه محصول"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <Button
                variant="outlined"
                onClick={() => {
                  setPage(1);
                  setAppliedQuery(query.trim());
                }}
              >
                جست‌وجو
              </Button>
            </Stack>
          </CardContent>
        </Card>
        <Card variant="outlined">
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>شناسه</TableCell>
                  <TableCell>نام</TableCell>
                  <TableCell>دسته‌بندی</TableCell>
                  <TableCell>وزن</TableCell>
                  <TableCell>قیمت</TableCell>
                  <TableCell>عملیات</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {products.map((product) => (
                  <TableRow key={product.product_id}>
                    <TableCell>{product.product_id}</TableCell>
                    <TableCell>{product.title}</TableCell>
                    <TableCell>
                      {categories.find((item) => item.category_id === product.category_id)?.title ??
                        product.category_id}
                    </TableCell>
                    <TableCell>{product.weight.toLocaleString('fa-IR')} گرم</TableCell>
                    <TableCell>
                      {Math.round(product.price / 10).toLocaleString('fa-IR')} تومان
                    </TableCell>
                    <TableCell>
                      <Button size="small" onClick={() => open(product)}>
                        ویرایش
                      </Button>
                      <Button size="small" color="error" onClick={() => remove(product)}>
                        حذف
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <Stack direction="row" justifyContent="center" gap={1} p={2}>
            <Button disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)}>
              قبل
            </Button>
            <Typography>صفحه {page.toLocaleString('fa-IR')}</Typography>
            <Button
              disabled={page * 20 >= total || loading}
              onClick={() => setPage((value) => value + 1)}
            >
              بعد
            </Button>
          </Stack>
        </Card>
        <Dialog
          open={editing !== undefined}
          onClose={() => setEditing(undefined)}
          fullWidth
          maxWidth="sm"
        >
          <DialogTitle>{editing ? 'ویرایش محصول تاپین' : 'محصول جدید تاپین'}</DialogTitle>
          <DialogContent>
            <Stack spacing={2} mt={1}>
              <TextField
                label="نام"
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
              />
              <TextField
                select
                label="دسته‌بندی"
                value={form.category_id}
                onChange={(event) => setForm({ ...form, category_id: event.target.value })}
              >
                {categories.map((item) => (
                  <MenuItem key={item.category_id} value={item.category_id}>
                    {item.title}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                type="number"
                label="وزن (گرم)"
                value={form.weight}
                onChange={(event) => setForm({ ...form, weight: Number(event.target.value) })}
              />
              <TextField
                type="number"
                label="قیمت (تومان)"
                value={form.priceToman}
                onChange={(event) => setForm({ ...form, priceToman: Number(event.target.value) })}
              />
              <TextField
                multiline
                minRows={3}
                label="توضیحات"
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditing(undefined)}>انصراف</Button>
            <Button
              variant="contained"
              disabled={loading || !form.title || !form.category_id || form.weight <= 0}
              onClick={save}
            >
              ذخیره
            </Button>
          </DialogActions>
        </Dialog>
        <Dialog open={catalogOpen} onClose={() => setCatalogOpen(false)} fullWidth maxWidth="lg">
          <DialogTitle>همگام‌سازی واریانت‌های داخلی با تاپین</DialogTitle>
          <DialogContent>
            <Stack spacing={2} mt={1}>
              <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
                <TextField
                  size="small"
                  fullWidth
                  label="جست‌وجوی نام یا SKU"
                  value={catalogQuery}
                  onChange={(event) => setCatalogQuery(event.target.value)}
                />
                <Button onClick={() => void loadCatalog()}>جست‌وجو</Button>
                <TextField
                  select
                  size="small"
                  label="دسته‌بندی تاپین"
                  value={syncCategory}
                  onChange={(event) => setSyncCategory(event.target.value)}
                  sx={{ minWidth: 220 }}
                >
                  {categories.map((item) => (
                    <MenuItem key={item.category_id} value={item.category_id}>
                      {item.title}
                    </MenuItem>
                  ))}
                </TextField>
              </Stack>
              <Alert severity="info">
                واریانت متصل، به‌روزرسانی و واریانت جدید در تاپین ساخته می‌شود. قیمت‌ها از تومان به
                ریال تبدیل می‌شوند.
              </Alert>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell padding="checkbox" />
                      <TableCell>محصول</TableCell>
                      <TableCell>SKU</TableCell>
                      <TableCell>وزن</TableCell>
                      <TableCell>قیمت</TableCell>
                      <TableCell>اتصال تاپین</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {catalogRows.map((row) => (
                      <TableRow key={row.variantId}>
                        <TableCell padding="checkbox">
                          <Checkbox
                            checked={selectedVariants.includes(row.variantId)}
                            disabled={!row.weight}
                            onChange={(event) =>
                              setSelectedVariants((items) =>
                                event.target.checked
                                  ? [...items, row.variantId]
                                  : items.filter((id) => id !== row.variantId),
                              )
                            }
                          />
                        </TableCell>
                        <TableCell>{row.title}</TableCell>
                        <TableCell>{row.sku}</TableCell>
                        <TableCell>
                          {row.weight
                            ? `${Number(row.weight).toLocaleString('fa-IR')} گرم`
                            : 'ثبت نشده'}
                        </TableCell>
                        <TableCell>{Number(row.price).toLocaleString('fa-IR')} تومان</TableCell>
                        <TableCell>
                          {(() => {
                            const mapped = shopId
                              ? row.tapinMappings?.find((item) => item.shopId === shopId)?.productId
                              : row.tapinProductId;
                            return mapped ? `#${mapped}` : 'جدید';
                          })()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCatalogOpen(false)}>بستن</Button>
            <Button
              variant="contained"
              disabled={loading || !selectedVariants.length || !syncCategory}
              onClick={syncCatalog}
            >
              همگام‌سازی {selectedVariants.length.toLocaleString('fa-IR')} مورد
            </Button>
          </DialogActions>
        </Dialog>
      </Stack>
    </Container>
  );
}

export default function TapinProducts() {
  return useTapinProductsView();
}
