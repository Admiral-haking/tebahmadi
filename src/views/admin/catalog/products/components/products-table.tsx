"use client";

import {
  Button,
  Card,
  Checkbox,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
  Chip,
  Stack,
} from "@mui/material";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import type { ProductListItem } from "..";

const STATUS_LABEL: Record<ProductListItem["status"], string> = {
  draft: "پیش‌نویس",
  active: "فعال",
  archived: "آرشیو",
};

const STATUS_COLOR: Record<ProductListItem["status"], "default" | "primary" | "warning" | "success" | "error"> = {
  draft: "warning",
  active: "success",
  archived: "default",
};

function formatNumber(value: number | undefined): string {
  if (value === undefined) return "-";
  return new Intl.NumberFormat("fa-IR").format(value);
}

export default function ProductsTable({
  products,
  page,
  pageSize,
  onRefresh,
}: {
  products: ProductListItem[];
  page: number;
  pageSize: number;
  onRefresh?: () => Promise<void> | void;
}) {
  const rowOffset = Math.max(0, page - 1) * pageSize;

  // ── Bulk selection + group status change ──────────────────────────────────
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const allIds = products.map((p) => p.id);
  const selectedCount = allIds.filter((id) => selected.has(id)).length;
  const allSelected = allIds.length > 0 && selectedCount === allIds.length;
  const someSelected = selectedCount > 0 && !allSelected;

  function toggleOne(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id); else next.delete(id);
      return next;
    });
  }
  function toggleAll(checked: boolean) {
    setSelected(checked ? new Set(allIds) : new Set());
  }

  async function applyBulkStatus(status: "active" | "draft" | "archived") {
    const ids = allIds.filter((id) => selected.has(id));
    if (!ids.length) return;
    const label = STATUS_LABEL[status];
    if (status === "archived" && !window.confirm(`آرشیو کردن ${ids.length} محصول؟`)) return;
    setBulkBusy(true);
    try {
      const response = await fetch("/api/catalog/products/bulk-status", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, status }),
      });
      if (!response.ok) {
        const message = (await response.text().catch(() => "")) || response.statusText;
        throw new Error(message || "خطا در بروزرسانی گروهی");
      }
      const data = (await response.json().catch(() => ({}))) as { modified?: number };
      toast.success(`${(data.modified ?? ids.length).toLocaleString("fa-IR")} محصول به «${label}» تغییر کرد`);
      setSelected(new Set());
      if (typeof onRefresh === "function") await onRefresh();
      else window.location.reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطا در بروزرسانی گروهی");
    } finally {
      setBulkBusy(false);
    }
  }

  async function handleArchive(id: string) {
    const confirmed = window.confirm("آیا از آرشیو کردن این محصول مطمئن هستید؟");
    if (!confirmed) return;

    const response = await fetch(`/api/catalog/products/${id}`, {
      method: "DELETE",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      const message = (await response.text().catch(() => "")) || response.statusText;
      toast.error(message || "خطا در بروزرسانی محصول");
      return;
    }

    toast.success("محصول با موفقیت آرشیو شد");
    if (typeof onRefresh === "function") {
      try {
        await onRefresh();
      } catch (err) {
        console.error(err);
        window.location.reload();
      }
    } else {
      window.location.reload();
    }
  }

  return (
    <Card>
      {selectedCount > 0 && (
        <Stack
          direction={{ xs: "column", sm: "row" }}
          alignItems={{ xs: "stretch", sm: "center" }}
          justifyContent="space-between"
          gap={1}
          sx={{ p: 1.5, bgcolor: "action.selected", borderBottom: 1, borderColor: "divider" }}
        >
          <Typography variant="body2" fontWeight={700}>
            {selectedCount.toLocaleString("fa-IR")} محصول انتخاب شده
          </Typography>
          <Stack direction="row" gap={1} flexWrap="wrap">
            <Button size="small" variant="contained" color="success" disabled={bulkBusy} onClick={() => applyBulkStatus("active")}>فعال‌سازی گروهی</Button>
            <Button size="small" variant="outlined" color="warning" disabled={bulkBusy} onClick={() => applyBulkStatus("draft")}>پیش‌نویس گروهی</Button>
            <Button size="small" variant="outlined" color="error" disabled={bulkBusy} onClick={() => applyBulkStatus("archived")}>آرشیو گروهی</Button>
            <Button size="small" color="inherit" disabled={bulkBusy} onClick={() => setSelected(new Set())}>لغو انتخاب</Button>
          </Stack>
        </Stack>
      )}
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox
                  size="small"
                  checked={allSelected}
                  indeterminate={someSelected}
                  disabled={allIds.length === 0}
                  onChange={(e) => toggleAll(e.target.checked)}
                  inputProps={{ "aria-label": "انتخاب همه" }}
                />
              </TableCell>
              <TableCell width={60}>#</TableCell>
              <TableCell>عنوان</TableCell>
              <TableCell>نوع محصول</TableCell>
              <TableCell align="right">وضعیت</TableCell>
              <TableCell align="right">بازه قیمت (تومان)</TableCell>
              <TableCell align="right">موجودی</TableCell>
              <TableCell align="right">واریانت‌ها</TableCell>
              <TableCell align="right">عملیات</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {products.map((product, index) => {
              const rowNumber = rowOffset + index + 1;
              let rangeLabel = "-";
              if (product.minPrice != null && product.maxPrice != null && product.minPrice !== product.maxPrice) {
                rangeLabel = `${formatNumber(product.minPrice)} تا ${formatNumber(product.maxPrice)}`;
              } else if (product.minPrice != null || product.maxPrice != null) {
                const price = product.minPrice ?? product.maxPrice;
                rangeLabel = formatNumber(price ?? undefined);
              }

              return (
                <TableRow key={product.id} hover selected={selected.has(product.id)}>
                  <TableCell padding="checkbox">
                    <Checkbox
                      size="small"
                      checked={selected.has(product.id)}
                      onChange={(e) => toggleOne(product.id, e.target.checked)}
                      inputProps={{ "aria-label": `انتخاب ${product.title}` }}
                    />
                  </TableCell>
                  <TableCell>{rowNumber}</TableCell>
                  <TableCell>
                    <Stack spacing={0.5}>
                      <Typography fontWeight={600}>{product.title}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {product.slug}
                      </Typography>
                    </Stack>
                  </TableCell>
                  <TableCell>{product.productTypeName}</TableCell>
                  <TableCell align="right">
                    <Chip
                      label={STATUS_LABEL[product.status]}
                      color={STATUS_COLOR[product.status]}
                      variant={product.status === "draft" ? "outlined" : "filled"}
                      size="small"
                    />
                  </TableCell>
                  <TableCell align="right">{rangeLabel}</TableCell>
                  <TableCell align="right">{formatNumber(product.inventoryTotal)}</TableCell>
                  <TableCell align="right">
                    <Stack direction="row" gap={0.5} justifyContent="flex-end" flexWrap="wrap">
                      <Chip size="small" variant="outlined" label={`کل: ${formatNumber(product.variantCount)}`} />
                      <Chip size="small" color="success" label={`فعال موجود: ${formatNumber(product.activeInStockVariantCount)}`} />
                      <Chip size="small" color="warning" variant="outlined" label={`غیرفعال/ناموجود: ${formatNumber(product.inactiveOrOutOfStockVariantCount)}`} />
                    </Stack>
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="ویرایش">
                      <IconButton LinkComponent={Link} href={`/admin/catalog/products/save?id=${product.id}`} aria-label="edit product">
                        <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24">
                          <circle cx={12} cy={12} r={10} fill="currentColor" opacity={0.5}></circle>
                          <path
                            fill="currentColor"
                            d="M13.926 14.302c.245-.191.467-.413.912-.858l5.54-5.54c.134-.134.073-.365-.106-.427a6.1 6.1 0 0 1-2.3-1.449a6.1 6.1 0 0 1-1.45-2.3c-.061-.18-.292-.24-.426-.106l-5.54 5.54c-.445.444-.667.667-.858.912a5 5 0 0 0-.577.932c-.133.28-.233.579-.431 1.175l-.257.77l-.409 1.226l-.382 1.148a.817.817 0 0 0 1.032 1.033l1.15-.383l1.224-.408l.77-.257c.597-.199.895-.298 1.175-.432q.498-.237.933-.576m8.187-8.132a3.028 3.028 0 0 0-4.282-4.283l-.179.178a.73.73 0 0 0-.206.651c.027.15.077.37.168.633a4.9 4.9 0 0 0 1.174 1.863a4.9 4.9 0 0 0 1.862 1.174c.263.09.483.141.633.168c.24.043.48-.035.652-.207z"
                          ></path>
                        </svg>
                      </IconButton>
                    </Tooltip>
                    {product.status !== "archived" && (
                      <Tooltip title="آرشیو">
                        <IconButton onClick={() => handleArchive(product.id)} aria-label="archive product">
                          <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24">
                            <path
                              fill="currentColor"
                              d="M2.75 6.167c0-.46.345-.834.771-.834h2.665c.529-.015.996-.378 1.176-.916l.03-.095l.115-.372c.07-.228.131-.427.217-.605c.338-.702.964-1.189 1.687-1.314c.184-.031.377-.031.6-.031h3.478c.223 0 .417 0 .6.031c.723.125 1.35.612 1.687 1.314c.086.178.147.377.217.605l.115.372l.03.095c.18.538.74.902 1.27.916h2.57c.427 0 .772.373.772.834S20.405 7 19.979 7H3.52c-.426 0-.771-.373-.771-.833"
                            ></path>
                            <path
                              fill="currentColor"
                              d="M11.607 22h.787c2.707 0 4.06 0 4.941-.863c.88-.864.97-2.28 1.15-5.111l.26-4.081c.098-1.537.147-2.305-.295-2.792s-1.187-.487-2.679-.487H8.23c-1.491 0-2.237 0-2.679.487s-.392 1.255-.295 2.792l.26 4.08c.18 2.833.27 4.248 1.15 5.112S8.9 22 11.607 22"
                              opacity={0.5}
                            ></path>
                          </svg>
                        </IconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}

            {products.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} align="center">
                  هیچ محصولی یافت نشد.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Card>
  );
}
