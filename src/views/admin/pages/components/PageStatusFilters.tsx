"use client";

import Link from "next/link";
import { Chip, Stack, Typography } from "@mui/material";

import type { PageStatus } from "..";

const STATUS_LABELS: Record<PageStatus, string> = {
  published: "منتشر شده",
  draft: "پیش‌نویس",
  archived: "آرشیوشده",
};

const STATUS_ORDER: PageStatus[] = ["published", "draft", "archived"];

interface PageStatusFiltersProps {
  currentStatuses: PageStatus[];
  q?: string;
  counts?: Record<PageStatus, number>;
}

function buildHref(statuses: PageStatus[], q?: string): string {
  const params = new URLSearchParams();
  statuses.forEach((status) => params.append("status", status));
  if (q && q.trim()) {
    params.set("q", q.trim());
  }
  const query = params.toString();
  return query ? `/admin/pages?${query}` : "/admin/pages";
}

export default function PageStatusFilters({ currentStatuses, q, counts }: PageStatusFiltersProps) {
  const active = new Set(currentStatuses);
  const hasFilter = active.size > 0;

  return (
    <Stack spacing={1.5}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="subtitle1" fontWeight={700}>
          فیلتر وضعیت
        </Typography>
        {hasFilter && (
          <Chip
            label="حذف فیلترها"
            variant="outlined"
            size="small"
            component={Link}
            href={buildHref([], q)}
            clickable
          />
        )}
      </Stack>

      <Stack direction="row" flexWrap="wrap" gap={1}>
        {STATUS_ORDER.map((status) => {
          const next = new Set(active);
          if (next.has(status)) {
            next.delete(status);
          } else {
            next.add(status);
          }
          const nextStatuses = Array.from(next);

          return (
            <Chip
              key={status}
              label={
                counts
                  ? `${STATUS_LABELS[status]} • ${(counts[status] ?? 0).toLocaleString("fa-IR")}`
                  : STATUS_LABELS[status]
              }
              color={active.has(status) ? "primary" : "default"}
              variant={active.has(status) ? "filled" : "outlined"}
              component={Link}
              href={buildHref(nextStatuses, q)}
              clickable
              sx={{ borderRadius: 2 }}
            />
          );
        })}
      </Stack>
    </Stack>
  );
}
