"use client";

import { ReactNode } from "react";
import {
  Box,
  Chip,
  InputAdornment,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import FilterAltOffRoundedIcon from "@mui/icons-material/FilterAltOffRounded";
import { Button } from "@mui/material";

export type FacetOption = { value: string; label: string; count?: number };

export type Facet = {
  /** Stable key for this facet group. */
  key: string;
  /** Persian label shown before the option chips. */
  label: string;
  options: FacetOption[];
  /** Currently selected values. */
  value: string[];
  /** Allow more than one option at once (default true). */
  multi?: boolean;
};

export type RangeFacet = {
  key: string;
  label: string;
  /** Current min / max as strings (empty = unbounded). */
  min: string;
  max: string;
  /** Optional unit shown after the inputs (e.g. "تومان"). */
  unit?: string;
};

/**
 * A reusable, fast, client-side filter bar for admin lists. Renders a search
 * field plus any number of chip-based facet groups, with a one-click reset.
 * Each list owns its state and filtering; this is purely the consistent UI.
 */
export default function ListFilterBar({
  search,
  onSearchChange,
  searchPlaceholder = "جستجو...",
  facets = [],
  ranges = [],
  onFacetChange,
  onRangeChange,
  onClear,
  right,
  resultCount,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  facets?: Facet[];
  ranges?: RangeFacet[];
  onFacetChange?: (key: string, values: string[]) => void;
  onRangeChange?: (key: string, next: { min: string; max: string }) => void;
  onClear?: () => void;
  /** Extra controls on the right (e.g. a refresh button). */
  right?: ReactNode;
  /** Optional "N نتیجه" badge. */
  resultCount?: number;
}) {
  const hasActive =
    Boolean(search.trim()) ||
    facets.some((f) => f.value.length > 0) ||
    ranges.some((r) => r.min.trim() || r.max.trim());

  function toggle(facet: Facet, value: string) {
    const has = facet.value.includes(value);
    let next: string[];
    if (facet.multi === false) {
      next = has ? [] : [value];
    } else {
      next = has ? facet.value.filter((v) => v !== value) : [...facet.value, value];
    }
    onFacetChange?.(facet.key, next);
  }

  return (
    <Paper variant="outlined" sx={{ p: 1.5, mb: 2 }}>
      <Stack gap={1.25}>
        <Stack direction={{ xs: "column", sm: "row" }} gap={1.25} alignItems={{ xs: "stretch", sm: "center" }}>
          <TextField
            size="small"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchRoundedIcon fontSize="small" /></InputAdornment> } }}
            sx={{ minWidth: { xs: "100%", sm: 280 }, flex: { sm: "1 1 280px" } }}
          />
          {resultCount !== undefined && (
            <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: "nowrap" }}>
              {resultCount.toLocaleString("fa-IR")} نتیجه
            </Typography>
          )}
          <Box flex={1} />
          {hasActive && onClear && (
            <Button size="small" color="inherit" startIcon={<FilterAltOffRoundedIcon fontSize="small" />} onClick={onClear}>
              پاک کردن فیلترها
            </Button>
          )}
          {right}
        </Stack>

        {facets.map((facet) => (
          <Stack key={facet.key} direction="row" gap={0.75} alignItems="center" flexWrap="wrap">
            <Typography variant="caption" color="text.secondary" sx={{ minWidth: 64 }}>
              {facet.label}:
            </Typography>
            {facet.options.map((opt) => {
              const active = facet.value.includes(opt.value);
              return (
                <Chip
                  key={opt.value}
                  size="small"
                  label={opt.count !== undefined ? `${opt.label} (${opt.count.toLocaleString("fa-IR")})` : opt.label}
                  color={active ? "primary" : "default"}
                  variant={active ? "filled" : "outlined"}
                  onClick={() => toggle(facet, opt.value)}
                  clickable
                />
              );
            })}
          </Stack>
        ))}

        {ranges.map((range) => (
          <Stack key={range.key} direction="row" gap={0.75} alignItems="center" flexWrap="wrap">
            <Typography variant="caption" color="text.secondary" sx={{ minWidth: 64 }}>
              {range.label}:
            </Typography>
            <TextField
              size="small" type="number" placeholder="از" value={range.min}
              onChange={(e) => onRangeChange?.(range.key, { min: e.target.value, max: range.max })}
              sx={{ width: 110 }}
              slotProps={{ input: { inputProps: { min: 0 } } }}
            />
            <Typography variant="caption" color="text.secondary">تا</Typography>
            <TextField
              size="small" type="number" placeholder="تا" value={range.max}
              onChange={(e) => onRangeChange?.(range.key, { min: range.min, max: e.target.value })}
              sx={{ width: 110 }}
              slotProps={{ input: { inputProps: { min: 0 } } }}
            />
            {range.unit && <Typography variant="caption" color="text.secondary">{range.unit}</Typography>}
          </Stack>
        ))}
      </Stack>
    </Paper>
  );
}
