"use client";

import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Chip,
  FormControlLabel,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";

import type { BlogPostStatus, BlogCategoryFilterOption } from "..";

const STATUS_LABELS: Record<BlogPostStatus, { label: string; color: "default" | "primary" | "success" | "warning" }> =
{
  draft: { label: "پیش‌نویس", color: "warning" },
  published: { label: "منتشر شده", color: "success" },
  archived: { label: "آرشیو", color: "default" },
};

interface PostsFiltersProps {
  statusCounts: Record<BlogPostStatus, number>;
  selectedStatuses: BlogPostStatus[];
  categories: BlogCategoryFilterOption[];
  selectedCategory: string | null;
  includeSubtree: boolean;
}

function buildParams(
  searchParams: URLSearchParams,
  updates: Record<string, string | null | undefined>
): string {
  const next = new URLSearchParams(searchParams.toString());

  Object.entries(updates).forEach(([key, value]) => {
    if (value == null || value.length === 0) {
      next.delete(key);
    } else {
      next.set(key, value);
    }
  });

  next.delete("page");
  return next.toString();
}

export default function PostsFilters({
  statusCounts,
  selectedStatuses,
  categories,
  selectedCategory,
  includeSubtree,
}: PostsFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const selectedSet = useMemo(() => new Set(selectedStatuses ?? []), [selectedStatuses]);

  function toggleStatus(status: BlogPostStatus) {
    const next = new Set(selectedSet);
    if (next.has(status)) {
      next.delete(status);
    } else {
      next.add(status);
    }
    const value = next.size > 0 ? Array.from(next).join(",") : null;
    const query = buildParams(new URLSearchParams(searchParams?.toString()), { status: value });
    router.push(query ? `${pathname}?${query}` : pathname || "/", { scroll: true });
  }

  function handleCategoryChange(event: React.ChangeEvent<HTMLInputElement>) {
    const value = event.target.value || null;
    const updates: Record<string, string | null> = {
      category: value,
    };
    if (!value) {
      updates.subtree = null;
    }
    const query = buildParams(new URLSearchParams(searchParams?.toString()), updates);
    router.push(query ? `${pathname}?${query}` : pathname || "/", { scroll: true });
  }

  function handleIncludeSubtreeChange(event: React.ChangeEvent<HTMLInputElement>) {
    const checked = event.target.checked;
    const query = buildParams(
      new URLSearchParams(searchParams?.toString()),
      checked ? { subtree: "1" } : { subtree: null }
    );
    router.push(query ? `${pathname}?${query}` : pathname || "/", { scroll: true });
  }

  return (
    <Stack
      direction={{ xs: "column", md: "row" }}
      spacing={2}
      alignItems={{ xs: "stretch", md: "center" }}
      sx={{ flex: 1 }}
    >
      <Stack direction="row" spacing={1} flexWrap="wrap">
        {(Object.keys(STATUS_LABELS) as BlogPostStatus[]).map((status) => {
          const meta = STATUS_LABELS[status];
          const selected = selectedSet.has(status);
          const count = statusCounts[status] ?? 0;
          const label = `${meta.label} (${count.toLocaleString("fa-IR")})`;
          return (
            <Tooltip key={status} title={selected ? "حذف از فیلتر" : "افزودن به فیلتر"}>
              <Chip
                label={label}
                color={selected ? meta.color : "default"}
                variant={selected ? "filled" : "outlined"}
                onClick={() => toggleStatus(status)}
                sx={{ borderRadius: 2 }}
              />
            </Tooltip>
          );
        })}
      </Stack>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ xs: "stretch", sm: "center" }}>
        <TextField
          select
          fullWidth
          size="small"
          label="فیلتر دسته"
          value={selectedCategory ?? ""}
          onChange={handleCategoryChange}
          sx={{ minWidth: { xs: "100%", sm: 220 } }}
        >
          <MenuItem value="">تمام دسته‌ها</MenuItem>
          {categories.map((category) => (
            <MenuItem key={category.id} value={category.id}>
              <Typography component="span" variant="body2">
                {"—".repeat(category.depth)} {category.name}
              </Typography>
            </MenuItem>
          ))}
        </TextField>

        <FormControlLabel
          control={<Switch size="small" color="primary" checked={includeSubtree} onChange={handleIncludeSubtreeChange} />}
          label="شامل زیردسته‌ها"
          disabled={!selectedCategory}
        />
      </Stack>
    </Stack>
  );
}
