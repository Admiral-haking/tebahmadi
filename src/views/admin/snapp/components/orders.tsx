import Orderly from "@/components/orderly";
import { Get } from "@/utils/fetch";
import {
  Box,
  Button,
  Checkbox,
  Chip,
  Container,
  LinearProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import ListFilterBar from "@/components/admin/list-filter-bar";
import { RefreshButton } from "@/components/refresh";
import { SnappOrdersResponse } from "@/snapp/api/type";
import { copyShippingText } from "@/orders/utils/shippingText";
import { snappOrderAmount } from "@/snapp/utils/price";

export default function SnappOrders({
  vendorId,
  snpVendorId,
}: {
  vendorId: string;
  snpVendorId: string;
}) {
  const [loading, setLoading] = useState(false);

  const [cursor, setCursor] = useState("");
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [facets, setFacets] = useState<Record<string, string[]>>({ status: [] });
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const [response, setResponse] = useState<SnappOrdersResponse>();
  const [itemMeta, setItemMeta] = useState<Record<string, { title: string; summary: string; imageId: string; slug: string }>>({});

  function metaFor(row: { sku: string | null; vendor_product_info_id: string }) {
    const meta = row.sku ? itemMeta[row.sku] : undefined;
    const fallback = row.sku || row.vendor_product_info_id;
    return {
      title: meta?.title || fallback,
      summary: meta?.summary || "",
      imageId: meta?.imageId || "",
    };
  }

  function handleLoadInventory() {
    setLoading(true);
    Get(
      `/api/snapp/${vendorId}/${snpVendorId}/orders?vendorId=${vendorId}&cursor=${cursor}`,
    )
      .then((res) => {
        setResponse(res);
        setItemMeta(res?.itemMeta ?? {});
      })
      .catch(() => toast.error("خطا در بارگیری سفارش‌های اسنپ‌شاپ"))
      .finally(() => setLoading(false));
  }

  useEffect(handleLoadInventory, [cursor]);

  function handleCopyOrder(item: SnappOrdersResponse["data"][number]) {
    copyShippingText({
      customerName: [item.customer?.first_name, item.customer?.last_name]
        .filter(Boolean)
        .join(" "),
      customerPhone: item.customer?.phone || item.customer?.address?.phone,
      postalCode: item.customer?.address?.postal_code,
      state: item.customer?.address?.province,
      city: item.customer?.address?.city,
      address: item.customer?.address?.address,
      houseNumber: item.customer?.address?.house_number,
      houseUnit: item.customer?.address?.house_unit,
      items: item.items.map((row) => {
        const meta = metaFor(row);
        return {
          title: meta.title,
          variantSummary: meta.summary,
          quantity: row.quantity - (row.canceled_quantity || 0),
        };
      }),
    })
      .then(() => toast.success("متن ارسال سفارش کپی شد."))
      .catch(() => toast.error("کپی متن ارسال انجام نشد."));
  }

  const statusOptions = useMemo(() => {
    const set = new Set<string>();
    (response?.data ?? []).forEach((o) => o.order_status && set.add(String(o.order_status)));
    return Array.from(set).map((s) => ({ value: s, label: s }));
  }, [response?.data]);

  const filtered = useMemo(() => {
    const items = response?.data ?? [];
    const term = deferredQuery.trim().toLowerCase();
    const { status = [] } = facets;
    return items.filter((item) => {
      if (term && ![
        item.order_number,
        item.order_status,
        item.customer?.first_name,
        item.customer?.last_name,
        item.customer?.phone,
      ].some((v) => String(v ?? "").toLowerCase().includes(term))) return false;
      if (status.length && !status.includes(String(item.order_status))) return false;
      return true;
    });
  }, [deferredQuery, response?.data, facets]);

  const allIds = filtered.map((o) => o.order_number);
  const selectedCount = allIds.filter((id) => selected.has(id)).length;
  const allSelected = allIds.length > 0 && selectedCount === allIds.length;

  function toggleOne(id: number, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id); else next.delete(id);
      return next;
    });
  }

  function handleBulkCopy() {
    const chosen = filtered.filter((o) => selected.has(o.order_number));
    if (!chosen.length) return;
    copyShippingText({
      items: chosen.flatMap((o) =>
        o.items.map((row) => {
          const meta = metaFor(row);
          return {
            title: meta.title,
            variantSummary: meta.summary,
            quantity: row.quantity - (row.canceled_quantity || 0),
          };
        }),
      ),
    })
      .then(() => toast.success(`متن ارسال ${chosen.length.toLocaleString("fa-IR")} سفارش کپی شد.`))
      .catch(() => toast.error("کپی متن ارسال انجام نشد."));
  }

  return (
    <Container maxWidth="lg" sx={{ my: 4 }}>
      <ListFilterBar
        search={query}
        onSearchChange={setQuery}
        searchPlaceholder="فیلتر: شماره سفارش، نام/موبایل گیرنده..."
        resultCount={filtered.length}
        onClear={() => { setQuery(""); setFacets({ status: [] }); }}
        onFacetChange={(key, values) => setFacets((p) => ({ ...p, [key]: values }))}
        right={<RefreshButton onClick={handleLoadInventory} />}
        facets={statusOptions.length ? [{ key: "status", label: "وضعیت", value: facets.status, options: statusOptions }] : []}
      />

      {selectedCount > 0 && (
        <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ xs: "stretch", sm: "center" }} justifyContent="space-between" gap={1}
          sx={{ mb: 2, p: 1.25, borderRadius: 2, bgcolor: "action.selected", border: 1, borderColor: "divider" }}>
          <Typography variant="body2" fontWeight={700}>{selectedCount.toLocaleString("fa-IR")} سفارش انتخاب شده</Typography>
          <Stack direction="row" gap={1}>
            <Button size="small" variant="contained" onClick={handleBulkCopy}>کپی متن گروهی</Button>
            <Button size="small" color="inherit" onClick={() => setSelected(new Set())}>لغو انتخاب</Button>
          </Stack>
        </Stack>
      )}

      {loading && <LinearProgress />}

      <TableContainer>
        <Table sx={{ minWidth: 1024 }}>
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox
                  size="small"
                  checked={allSelected}
                  indeterminate={selectedCount > 0 && !allSelected}
                  disabled={allIds.length === 0}
                  onChange={(e) => setSelected(e.target.checked ? new Set(allIds) : new Set())}
                  inputProps={{ "aria-label": "انتخاب همه" }}
                />
              </TableCell>
              <TableCell>شماره سفارش</TableCell>
              <TableCell>وضعیت</TableCell>
              <TableCell>تعداد</TableCell>
              <TableCell>تعداد لغو شده</TableCell>
              <TableCell>مبلغ</TableCell>
              <TableCell></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.map((item) => (
              <TableRow key={item.order_number} selected={selected.has(item.order_number)}>
                <TableCell padding="checkbox">
                  <Checkbox
                    size="small"
                    checked={selected.has(item.order_number)}
                    onChange={(e) => toggleOne(item.order_number, e.target.checked)}
                    inputProps={{ "aria-label": `انتخاب سفارش ${item.order_number}` }}
                  />
                </TableCell>
                <TableCell>{item.order_number}</TableCell>
                <TableCell>
                  <Typography
                    variant="body2"
                    color={
                      item.order_status === "CONFIRMED" ? "success.main" : "error.main"
                    }
                  >
                    {item.order_status}
                  </Typography>
                </TableCell>

                <TableCell>
                  {item.items.reduce((t, c) => t + c.quantity, 0)}
                </TableCell>
                <TableCell>
                  {item.items.reduce((t, c) => t + c.canceled_quantity, 0)}
                </TableCell>
                <TableCell>
                  {(snappOrderAmount(item.items) / 10).toLocaleString()}{" "}
                  تومان
                </TableCell>
                <TableCell align="right">
                  <Stack direction="row" gap={1} justifyContent="flex-end">
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => handleCopyOrder(item)}
                    >
                      کپی متن
                    </Button>
                    <Orderly
                      buttonProps={{
                        variant: "contained",
                        size: "small",
                        children: " جزئیات",
                      }}
                      mountChildrenOnOpen
                      hideFinish
                      title={`جزئیات سفارش ${item.order_number}`}
                    >
                      <Stack gap={1}>
                        <Typography variant="body2">
                          گیرنده:{" "}
                          {[item.customer?.first_name, item.customer?.last_name]
                            .filter(Boolean)
                            .join(" ") || "-"}
                        </Typography>
                        <Typography variant="body2">
                          موبایل:{" "}
                          {item.customer?.phone ||
                            item.customer?.address?.phone ||
                            "-"}
                        </Typography>
                        <Typography variant="body2">
                          آدرس:{" "}
                          {[
                            item.customer?.address?.province,
                            item.customer?.address?.city,
                            item.customer?.address?.address,
                          ]
                            .filter(Boolean)
                            .join("، ") || "-"}
                        </Typography>

                        <Typography variant="subtitle2" sx={{ mt: 1 }}>اقلام سفارش</Typography>
                        <Stack
                          divider={<Box sx={{ borderTop: 1, borderColor: "divider" }} />}
                          sx={{ border: 1, borderColor: "divider", borderRadius: 1.5, overflow: "hidden" }}
                        >
                          {item.items.map((row, i) => {
                            const meta = metaFor(row);
                            const net = row.quantity - (row.canceled_quantity || 0);
                            return (
                              <Stack key={`${item.order_number}-${row.sku ?? row.vendor_product_info_id}-${i}`}
                                direction="row" gap={1} alignItems="center" sx={{ p: 1 }}>
                                <Box
                                  component="img"
                                  src={meta.imageId ? `/api/media/${meta.imageId}` : "/product-placeholder.svg"}
                                  alt={meta.title}
                                  sx={{ width: 44, height: 44, borderRadius: 1, objectFit: "cover", flexShrink: 0, bgcolor: "background.default" }}
                                />
                                <Stack sx={{ flex: 1, minWidth: 0 }}>
                                  <Typography variant="body2" fontWeight={700} noWrap>{meta.title}</Typography>
                                  {meta.summary ? (
                                    <Typography variant="caption" color="text.secondary" noWrap>{meta.summary}</Typography>
                                  ) : null}
                                  <Typography variant="caption" color="text.secondary">کد: {row.sku || row.vendor_product_info_id}</Typography>
                                </Stack>
                                <Stack alignItems="flex-end" sx={{ flexShrink: 0 }}>
                                  <Chip size="small" color={net > 0 ? "success" : "default"} label={`${net} عدد`} />
                                  {row.canceled_quantity ? (
                                    <Typography variant="caption" color="error.main">لغو: {row.canceled_quantity}</Typography>
                                  ) : null}
                                </Stack>
                              </Stack>
                            );
                          })}
                        </Stack>

                        <Button
                          variant="outlined"
                          onClick={() => handleCopyOrder(item)}
                        >
                          کپی متن ارسال
                        </Button>
                      </Stack>
                    </Orderly>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
            {!loading && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={7}>
                  <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ py: 3 }}>
                    {query.trim() ? `برای فیلتر «${query}» سفارشی یافت نشد.` : "سفارشی برای نمایش دریافت نشد."}
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      <Stack direction="row" gap={2}>
        <Box flex="1 1 auto" />
        {!!response?.meta?.pagination.next_cursor && (
          <Button
            onClick={() => setCursor(response?.meta?.pagination.next_cursor)}
          >
            صفحه بعد
          </Button>
        )}
      </Stack>
    </Container>
  );
}
