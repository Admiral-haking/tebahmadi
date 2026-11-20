"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Box,
  Button,
  Chip,
  InputAdornment,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import FilterAltOffRoundedIcon from "@mui/icons-material/FilterAltOffRounded";

type ProductTypeOption = { id: string; name: string };

const STATUS_OPTIONS: { value: "active" | "draft" | "archived"; label: string; color: "success" | "warning" | "default" }[] = [
  { value: "active", label: "فعال", color: "success" },
  { value: "draft", label: "پیش‌نویس", color: "warning" },
  { value: "archived", label: "آرشیو", color: "default" },
];

/**
 * Complete, self-contained filter/search bar for the products list. Drives the
 * URL query (q, status[], productTypeId), which the page reads to build its API
 * request. Search submits on Enter or after a short debounce; status is a
 * multi-toggle; product type is a dropdown. Resetting clears everything.
 */
export default function ProductsFilterBar({
  q,
  status,
  productTypeId,
}: {
  q: string;
  status: string[];
  productTypeId: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [term, setTerm] = useState(q);
  const [types, setTypes] = useState<ProductTypeOption[]>([]);

  // Keep the local search box in sync if the URL changes elsewhere.
  useEffect(() => { setTerm(q); }, [q]);

  // Load product types once for the dropdown.
  useEffect(() => {
    let alive = true;
    fetch("/api/catalog/product-types", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { productTypes: [] }))
      .then((d) => { if (alive) setTypes(Array.isArray(d?.productTypes) ? d.productTypes : []); })
      .catch(() => null);
    return () => { alive = false; };
  }, []);

  /** Merge updates into the current query, always resetting to page 1. */
  function apply(updates: { q?: string; status?: string[]; productTypeId?: string }) {
    const params = new URLSearchParams(Array.from(searchParams?.entries() ?? []));
    params.delete("page");

    if (updates.q !== undefined) {
      if (updates.q.trim()) params.set("q", updates.q.trim());
      else params.delete("q");
    }
    if (updates.status !== undefined) {
      params.delete("status");
      updates.status.forEach((s) => params.append("status", s));
    }
    if (updates.productTypeId !== undefined) {
      if (updates.productTypeId) params.set("productTypeId", updates.productTypeId);
      else params.delete("productTypeId");
    }
    router.replace(`/admin/catalog/products?${params.toString()}`);
  }

  // Debounce free-text search so we don't hit the API on every keystroke.
  useEffect(() => {
    const handle = setTimeout(() => {
      if (term.trim() !== q.trim()) apply({ q: term });
    }, 450);
    return () => clearTimeout(handle);
  }, [term]);

  function toggleStatus(value: string) {
    const next = status.includes(value) ? status.filter((s) => s !== value) : [...status, value];
    apply({ status: next });
  }

  const hasFilters = useMemo(
    () => Boolean(q.trim()) || status.length > 0 || Boolean(productTypeId),
    [q, status, productTypeId],
  );

  return (
    <Paper variant="outlined" sx={{ p: 1.5, mb: 3 }}>
      <Stack direction={{ xs: "column", md: "row" }} gap={1.5} alignItems={{ xs: "stretch", md: "center" }} flexWrap="wrap">
        <TextField
          size="small"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") apply({ q: term }); }}
          placeholder="جستجو: عنوان، شناسه، SKU..."
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchRoundedIcon fontSize="small" /></InputAdornment> } }}
          sx={{ minWidth: { xs: "100%", md: 280 }, flex: { md: "1 1 280px" } }}
        />

        <TextField
          select size="small" label="نوع محصول"
          value={productTypeId}
          onChange={(e) => apply({ productTypeId: e.target.value })}
          sx={{ minWidth: { xs: "100%", md: 200 } }}
        >
          <MenuItem value="">همه نوع‌ها</MenuItem>
          {types.map((t) => <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>)}
        </TextField>

        <Stack direction="row" gap={0.75} alignItems="center" flexWrap="wrap">
          <Typography variant="caption" color="text.secondary">وضعیت:</Typography>
          {STATUS_OPTIONS.map((s) => {
            const active = status.includes(s.value);
            return (
              <Chip
                key={s.value}
                label={s.label}
                size="small"
                color={active ? s.color : "default"}
                variant={active ? "filled" : "outlined"}
                onClick={() => toggleStatus(s.value)}
                clickable
              />
            );
          })}
        </Stack>

        <Box flex={1} />

        {hasFilters && (
          <Button
            size="small"
            color="inherit"
            startIcon={<FilterAltOffRoundedIcon fontSize="small" />}
            onClick={() => { setTerm(""); router.replace("/admin/catalog/products"); }}
          >
            پاک کردن فیلترها
          </Button>
        )}
      </Stack>
    </Paper>
  );
}
