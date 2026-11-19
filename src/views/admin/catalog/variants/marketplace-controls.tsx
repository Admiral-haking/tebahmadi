"use client";

import { useState } from "react";
import { Box, Button, Chip, Divider, FormControlLabel, LinearProgress, Paper, Stack, Switch, TextField, Tooltip, Typography } from "@mui/material";
import Image from "next/image";
import { toast } from "sonner";
import { PATCH } from "@/utils/fetch";
import JalaliDateField from "@/components/jalali-date-field";

import digikala from "@/layout/assets/digikala.jpeg";
import snapp from "@/layout/assets/snapp.jpg";
import basalaam from "@/layout/assets/basalaam.png";
import type { VariantResponse } from "./type";

type Service = "dgk" | "snp" | "bsl";

const fa = (n: number) => Number(n || 0).toLocaleString("fa-IR");

type PanelMeta = { service: Service; label: string; icon: typeof digikala; color: "warning" | "error" | "success" };

const PANELS: PanelMeta[] = [
  { service: "dgk", label: "دیجی‌کالا", icon: digikala, color: "error" },
  { service: "snp", label: "اسنپ‌شاپ", icon: snapp, color: "warning" },
  { service: "bsl", label: "باسلام", icon: basalaam, color: "success" },
];

/**
 * Full per-panel view of every marketplace a variant is linked to. Each
 * connected panel (every branch of Digikala / Snapp / Basalam) is shown on its
 * own row with the panel icon + branch name + its price (تومان) + stock — nothing
 * collapsed, so a variant on several panels shows all of them with full values.
 */
export function MarketplaceBadges({ variant }: { variant: VariantResponse }) {
  const rows = PANELS.flatMap((p) => {
    const items =
      p.service === "dgk" ? (variant.dgk ?? []).map((d) => ({ vendorId: d.vendorId, price: d.price, quantity: d.quantity }))
      : p.service === "snp" ? (variant.snp ?? []).map((s) => ({ vendorId: s.vendorId, price: s.price, quantity: s.quantity }))
      : (variant.bsl ?? []).map((b) => ({ vendorId: b.vendorId, price: b.price, quantity: b.quantity }));
    return items.map((it, i) => ({ ...p, ...it, key: `${p.service}-${it.vendorId}-${i}` }));
  });

  if (!rows.length) {
    return <Chip size="small" variant="outlined" label="بدون اتصال" color="default" />;
  }

  return (
    <Stack gap={0.5} sx={{ minWidth: 200 }}>
      {rows.map((r) => (
        <Stack
          key={r.key}
          direction="row"
          alignItems="center"
          gap={0.75}
          sx={{ px: 0.75, py: 0.4, borderRadius: 1, border: 1, borderColor: `${r.color}.light`, bgcolor: "background.paper" }}
        >
          <Box component={Image} src={r.icon} width={18} height={18} alt={r.label} style={{ borderRadius: 4, flexShrink: 0 }} />
          <Tooltip title={`${r.label} — شعبه ${r.vendorId}`}>
            <Typography variant="caption" fontWeight={700} sx={{ maxWidth: 88, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {r.vendorId}
            </Typography>
          </Tooltip>
          <Box flex={1} />
          <Chip size="small" variant="outlined" color="primary" sx={{ height: 20 }} label={`${fa(r.price)} ت`} />
          <Chip size="small" color={r.quantity > 0 ? "success" : "default"} sx={{ height: 20 }} label={`${fa(r.quantity)} عدد`} />
        </Stack>
      ))}
    </Stack>
  );
}

/** One editable marketplace link (price / stock / — Digikala only — active). */
function ServiceRow({
  service, label, icon, color, vendorId, barcode, price, quantity, supportsActive, supportsDiscount, supportsDiscountTime, onUpdated,
}: {
  service: Service;
  label: string;
  icon: typeof digikala;
  color: PanelMeta["color"];
  vendorId: string;
  barcode: string;
  price: number;
  quantity: number;
  supportsActive: boolean;
  supportsDiscount: boolean;
  supportsDiscountTime: boolean;
  onUpdated?: (patch: { price?: number; stock?: number }) => void;
}) {
  const [priceVal, setPriceVal] = useState(String(price ?? 0));
  const [stockVal, setStockVal] = useState(String(quantity ?? 0));
  const [discountVal, setDiscountVal] = useState("");
  const [startVal, setStartVal] = useState("");
  const [endVal, setEndVal] = useState("");
  const [busy, setBusy] = useState(false);
  // The marketplace values last confirmed by a successful push — shown as a chip
  // so the admin gets immediate visual feedback (the inputs alone don't prove the
  // value landed, and a stock of 0 looks unchanged otherwise).
  const [savedPrice, setSavedPrice] = useState(price ?? 0);
  const [savedStock, setSavedStock] = useState(quantity ?? 0);
  const [active, setActive] = useState(true);

  async function toggleActive(checked: boolean) {
    setActive(checked); // optimistic
    setBusy(true);
    try {
      await PATCH(`/api/marketplace/variant-control`, { service, vendorId, barcode, active: checked });
      toast.success(`${label}: ${checked ? "فعال شد" : "غیرفعال شد"}`);
    } catch (e) {
      setActive(!checked); // revert on failure
      toast.error(e instanceof Error ? e.message : `${label}: خطا در تغییر وضعیت`);
    } finally {
      setBusy(false);
    }
  }

  async function send(payload: { price?: number; stock?: number; active?: boolean; discountPrice?: number; discountStart?: string; discountEnd?: string }) {
    setBusy(true);
    try {
      const res = await PATCH<{ current?: { price?: number; quantity?: number } | null }>(
        `/api/marketplace/variant-control`, { service, vendorId, barcode, ...payload },
      );
      toast.success(`${label}: بروزرسانی شد`);
      // Prefer the persisted value the server read back; fall back to the input
      // only if the record couldn't be re-read.
      const nextPrice = res?.current?.price ?? payload.price;
      const nextStock = res?.current?.quantity ?? payload.stock;
      if (nextPrice !== undefined) {
        setSavedPrice(nextPrice);
        setPriceVal(String(nextPrice));
      }
      if (nextStock !== undefined) {
        setSavedStock(nextStock);
        setStockVal(String(nextStock));
      }
      if (nextPrice !== undefined || nextStock !== undefined) {
        onUpdated?.({ price: nextPrice, stock: nextStock });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : `${label}: خطا در بروزرسانی`);
    } finally {
      setBusy(false);
    }
  }

  const accent = color; // warning | error | success — the brand tone of this panel

  return (
    <Paper
      variant="outlined"
      sx={{
        position: "relative",
        p: { xs: 1.5, md: 2 },
        borderRadius: 2.5,
        borderColor: `rgba(var(--mui-palette-${accent}-mainChannel) / 0.35)`,
        background: `linear-gradient(160deg, rgba(var(--mui-palette-${accent}-mainChannel) / 0.06) 0%, rgba(var(--mui-palette-background-paperChannel) / 0.9) 60%)`,
        opacity: supportsActive && !active ? 0.72 : 1,
        transition: "opacity .2s",
      }}
    >
      {busy && (
        <LinearProgress
          color={accent}
          sx={{ position: "absolute", insetInline: 0, top: 0, height: 3, borderTopLeftRadius: 10, borderTopRightRadius: 10 }}
        />
      )}

      {/* ── Header: brand + branch + live saved values + active ── */}
      <Stack direction="row" alignItems="center" gap={1.25} flexWrap="wrap">
        <Box
          sx={{
            width: 36, height: 36, borderRadius: 1.5, display: "grid", placeItems: "center", flexShrink: 0,
            bgcolor: `rgba(var(--mui-palette-${accent}-mainChannel) / 0.12)`,
          }}
        >
          <Box component={Image} src={icon} width={22} height={22} alt={label} style={{ borderRadius: 4 }} />
        </Box>
        <Stack sx={{ minWidth: 120 }}>
          <Typography variant="body2" fontWeight={800}>{label}</Typography>
          <Typography variant="caption" color="text.secondary">شعبه {vendorId}</Typography>
        </Stack>

        <Box flex={1} />

        <Stack direction="row" gap={0.75} alignItems="center" flexWrap="wrap">
          <Chip size="small" variant="outlined" color="primary" label={`${fa(savedPrice)} تومان`} />
          <Chip size="small" color={savedStock > 0 ? "success" : "default"} label={`${fa(savedStock)} عدد`} />
          {supportsActive && (
            <Chip
              size="small"
              color={active ? "success" : "default"}
              variant={active ? "filled" : "outlined"}
              label={active ? "فعال" : "غیرفعال"}
            />
          )}
        </Stack>
      </Stack>

      <Divider sx={{ my: 1.5, borderColor: `rgba(var(--mui-palette-${accent}-mainChannel) / 0.2)` }} />

      {/* ── Editable controls ── */}
      <Stack direction="row" gap={1.25} flexWrap="wrap" alignItems="flex-end">
        <Stack direction="row" gap={0.75} alignItems="flex-end">
          <Tooltip title="قیمت اصلی / خط‌خوردهٔ این مارکت‌پلیس (قبل از تخفیف)">
            <TextField
              size="small" label="قیمت اصلی (تومان)" type="number" value={priceVal}
              onChange={(e) => setPriceVal(e.target.value)} disabled={busy} sx={{ width: 160 }}
            />
          </Tooltip>
          <Button size="small" variant="contained" color={accent} disableElevation disabled={busy} onClick={() => send({ price: Number(priceVal) || 0 })}>
            ذخیره
          </Button>
        </Stack>

        <Stack direction="row" gap={0.75} alignItems="flex-end">
          <TextField
            size="small" label="موجودی" type="number" value={stockVal} inputProps={{ min: 0 }}
            onChange={(e) => setStockVal(e.target.value)} disabled={busy} sx={{ width: 110 }}
          />
          <Button size="small" variant="contained" color={accent} disableElevation disabled={busy} onClick={() => send({ stock: Math.max(0, Number(stockVal) || 0) })}>
            ذخیره
          </Button>
        </Stack>

        {supportsActive && (
          <FormControlLabel
            sx={{ ml: 0 }}
            control={<Switch size="small" checked={active} disabled={busy} onChange={(_, checked) => toggleActive(checked)} />}
            label={<Typography variant="caption" color="text.secondary">{active ? "فعال" : "غیرفعال"}</Typography>}
          />
        )}
      </Stack>

      {supportsDiscount && (
        <Stack
          direction={{ xs: "column", sm: "row" }} gap={0.75} alignItems={{ sm: "flex-end" }} flexWrap="wrap"
          sx={{ mt: 1.25, pt: 1.25, borderTop: 1, borderColor: "divider" }}
        >
          <Tooltip title="قیمت فروش با تخفیف (کمتر از قیمت اصلی)">
            <TextField
              size="small" label="قیمت با تخفیف (تومان)" type="number" value={discountVal}
              onChange={(e) => setDiscountVal(e.target.value)} disabled={busy} sx={{ width: 170 }}
            />
          </Tooltip>
          {supportsDiscountTime && (
            <>
              <JalaliDateField size="small" label="شروع" withTime value={startVal}
                onChange={setStartVal} disabled={busy} sx={{ maxWidth: 190 }} />
              <JalaliDateField size="small" label="پایان" withTime value={endVal}
                onChange={setEndVal} disabled={busy} sx={{ maxWidth: 190 }} />
            </>
          )}
          <Button size="small" variant="outlined" color="warning" disabled={busy}
            onClick={() => send({ discountPrice: Number(discountVal) || 0, discountStart: startVal || undefined, discountEnd: endVal || undefined })}>
            ذخیره تخفیف
          </Button>
        </Stack>
      )}
    </Paper>
  );
}

/**
 * Per-variant marketplace control panel: lists every connected marketplace link
 * (Digikala / Snapp / Basalam) and lets the admin set price, stock and (Digikala)
 * active status INDEPENDENTLY per marketplace — unlike the row's site fields,
 * which sync one value to all.
 */
export default function MarketplaceControls({ variant, onUpdated }: {
  variant: VariantResponse;
  /** Notified after a successful per-marketplace push so the parent can refresh. */
  onUpdated?: (service: Service, vendorId: string, barcode: string, patch: { price?: number; stock?: number }) => void;
}) {
  // Push with each marketplace record's OWN barcode — not the site variant's.
  // Links can be matched by variantId (after a catalog re-import the barcodes can
  // differ), and the per-service push helpers resolve the record by
  // { vendorId, barcode }. Using the site barcode would miss those records and
  // silently update nothing.
  const groups: { service: Service; label: string; icon: typeof digikala; color: PanelMeta["color"]; items: { vendorId: string; barcode: string; price: number; quantity: number }[]; supportsActive: boolean; supportsDiscount: boolean; supportsDiscountTime: boolean }[] = [
    { service: "dgk", label: "دیجی‌کالا", icon: digikala, color: "error", supportsActive: true, supportsDiscount: true, supportsDiscountTime: false, items: (variant.dgk ?? []).map((d) => ({ vendorId: d.vendorId, barcode: d.barcode, price: d.price, quantity: d.quantity })) },
    { service: "snp", label: "اسنپ‌شاپ", icon: snapp, color: "warning", supportsActive: false, supportsDiscount: true, supportsDiscountTime: true, items: (variant.snp ?? []).map((s) => ({ vendorId: s.vendorId, barcode: s.barcode, price: s.price, quantity: s.quantity })) },
    { service: "bsl", label: "باسلام", icon: basalaam, color: "success", supportsActive: false, supportsDiscount: true, supportsDiscountTime: false, items: (variant.bsl ?? []).map((b) => ({ vendorId: b.vendorId, barcode: b.barcode, price: b.price, quantity: b.quantity })) },
  ];

  const hasAny = groups.some((g) => g.items.length > 0);
  if (!hasAny) {
    return <Typography variant="caption" color="text.secondary">این واریانت به هیچ مارکت‌پلیسی متصل نیست.</Typography>;
  }

  return (
    <Stack gap={1}>
      <Typography variant="caption" color="text.secondary">
        کنترل جداگانهٔ قیمت / موجودی / وضعیت برای هر مارکت‌پلیس (مستقل از قیمت سایت)
      </Typography>
      {groups.flatMap((g) =>
        g.items.map((it, i) => {
          const usedBarcode = it.barcode || variant.barcode;
          return (
            <ServiceRow
              key={`${g.service}-${it.vendorId}-${i}`}
              service={g.service}
              label={g.label}
              icon={g.icon}
              color={g.color}
              vendorId={it.vendorId}
              barcode={usedBarcode}
              price={it.price}
              quantity={it.quantity}
              supportsActive={g.supportsActive}
              supportsDiscount={g.supportsDiscount}
              supportsDiscountTime={g.supportsDiscountTime}
              onUpdated={(patch) => onUpdated?.(g.service, it.vendorId, usedBarcode, patch)}
            />
          );
        }),
      )}
      {(variant.dgk?.length ?? 0) > 0 && (
        <Typography variant="caption" color="text.secondary">
          ℹ️ تخفیف دیجی‌کالا با کاهش «قیمت فروش» اعمال می‌شود (کمپین‌های ویژهٔ دیجی‌کالا جداگانه‌اند).
        </Typography>
      )}
    </Stack>
  );
}
