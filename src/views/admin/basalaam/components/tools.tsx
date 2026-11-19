"use client";

import { useState } from "react";
import {
    Alert,
    Box,
    Button,
    Chip,
    CircularProgress,
    Divider,
    Grid,
    Paper,
    Stack,
    TextField,
    Typography,
} from "@mui/material";
import { toast } from "sonner";
import { Get, POST, DELETE } from "@/utils/fetch";

const fa = (n: number) => Number(n || 0).toLocaleString("fa-IR");

function Section({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
    return (
        <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2.5 }}>
            <Typography variant="subtitle1" fontWeight={800}>{title}</Typography>
            {desc ? <Typography variant="caption" color="text.secondary">{desc}</Typography> : null}
            <Box sx={{ mt: 1.5 }}>{children}</Box>
        </Paper>
    );
}

export default function BslTools({ vendorId }: { vendorId: string }) {
    // ── Order stats ──
    const [stats, setStats] = useState<{ total: number; byStatus: Record<string, number>; derived: boolean } | null>(null);
    const [statsBusy, setStatsBusy] = useState(false);
    function loadStats() {
        setStatsBusy(true);
        Get(`/api/basalaam/stats?vendorId=${encodeURIComponent(vendorId)}`)
            .then(setStats)
            .catch((e) => toast.error(e?.message || "خطا در دریافت آمار"))
            .finally(() => setStatsBusy(false));
    }

    // ── Search ──
    const [q, setQ] = useState("");
    const [searchBusy, setSearchBusy] = useState(false);
    const [results, setResults] = useState<any[]>([]);
    function runSearch() {
        if (!q.trim()) return;
        setSearchBusy(true);
        Get(`/api/basalaam/search?q=${encodeURIComponent(q.trim())}`)
            .then((res) => setResults(Array.isArray(res) ? res : res?.products ?? []))
            .catch((e) => toast.error(e?.message || "خطا در جستجو"))
            .finally(() => setSearchBusy(false));
    }

    // ── Discount ──
    const [discIds, setDiscIds] = useState("");
    const [discPercent, setDiscPercent] = useState("");
    const [discBusy, setDiscBusy] = useState(false);
    // Product picker for discounts (search linked Basalam products, select by id).
    const [prodQ, setProdQ] = useState("");
    const [prodBusy, setProdBusy] = useState(false);
    const [products, setProducts] = useState<any[]>([]);
    const [picked, setPicked] = useState<Record<number, string>>({});
    function loadProducts() {
        setProdBusy(true);
        Get(`/api/basalaam/products?vendorId=${encodeURIComponent(vendorId)}&q=${encodeURIComponent(prodQ.trim())}`)
            .then((res) => setProducts(res?.items ?? []))
            .catch((e) => toast.error(e?.message || "خطا در بارگیری محصولات"))
            .finally(() => setProdBusy(false));
    }
    function togglePick(id: number, name: string) {
        setPicked((prev) => {
            const next = { ...prev };
            if (next[id]) delete next[id]; else next[id] = name;
            return next;
        });
    }
    function parseIds() {
        const manual = discIds.split(/[,\s]+/).map((s) => Number(s.trim())).filter((n) => Number.isFinite(n) && n > 0);
        return Array.from(new Set([...Object.keys(picked).map(Number), ...manual]));
    }
    function applyDiscount() {
        const product_ids = parseIds();
        const discount_percent = Number(discPercent);
        if (!product_ids.length || !discount_percent) { toast.error("شناسهٔ محصول و درصد تخفیف لازم است"); return; }
        setDiscBusy(true);
        POST("/api/basalaam/discount", { vendorId, product_ids, discount_percent })
            .then(() => toast.success("تخفیف اعمال شد"))
            .catch((e) => toast.error(e?.message || "خطا در اعمال تخفیف"))
            .finally(() => setDiscBusy(false));
    }
    function removeDiscount() {
        const product_ids = parseIds();
        if (!product_ids.length) { toast.error("شناسهٔ محصول لازم است"); return; }
        setDiscBusy(true);
        DELETE("/api/basalaam/discount", {}, { vendorId, product_ids })
            .then(() => toast.success("تخفیف حذف شد"))
            .catch((e) => toast.error(e?.message || "خطا در حذف تخفیف"))
            .finally(() => setDiscBusy(false));
    }

    // ── Webhook ──
    const [events, setEvents] = useState<any[]>([]);
    const [selectedEvents, setSelectedEvents] = useState<number[]>([]);
    const [hookBusy, setHookBusy] = useState(false);
    const [hooks, setHooks] = useState<any[]>([]);
    function loadEvents() {
        setHookBusy(true);
        Get(`/api/basalaam/webhooks?vendorId=${encodeURIComponent(vendorId)}&kind=events`)
            .then((res) => setEvents(Array.isArray(res) ? res : res?.data ?? []))
            .catch((e) => toast.error(e?.message || "خطا در دریافت رویدادها"))
            .finally(() => setHookBusy(false));
    }
    function loadHooks() {
        setHookBusy(true);
        Get(`/api/basalaam/webhooks?vendorId=${encodeURIComponent(vendorId)}&kind=list`)
            .then((res) => setHooks(Array.isArray(res) ? res : res?.data ?? []))
            .catch((e) => toast.error(e?.message || "خطا در دریافت وب‌هوک‌ها"))
            .finally(() => setHookBusy(false));
    }
    function deleteHook(webhook_id: number) {
        setHookBusy(true);
        DELETE("/api/basalaam/webhooks", {}, { vendorId, webhook_id })
            .then(() => { toast.success("وب‌هوک حذف شد"); setHooks((prev) => prev.filter((h) => Number(h.id ?? h.webhook_id) !== webhook_id)); })
            .catch((e) => toast.error(e?.message || "خطا در حذف وب‌هوک"))
            .finally(() => setHookBusy(false));
    }
    function setupWebhook() {
        if (!selectedEvents.length) { toast.error("حداقل یک رویداد را انتخاب کنید"); return; }
        setHookBusy(true);
        POST("/api/basalaam/webhooks", { vendorId, event_ids: selectedEvents })
            .then((res) => toast.success(`وب‌هوک روی ${res?.receiverUrl || "گیرنده"} راه‌اندازی شد`))
            .catch((e) => toast.error(e?.message || "خطا در راه‌اندازی وب‌هوک"))
            .finally(() => setHookBusy(false));
    }

    return (
        <Stack gap={2} sx={{ my: 3 }}>
            <Section title="آمار سفارش‌ها" desc="تعداد سفارش‌ها به تفکیک وضعیت">
                <Stack direction="row" gap={1} flexWrap="wrap" alignItems="center">
                    <Button size="small" variant="outlined" disabled={statsBusy} onClick={loadStats}>
                        {statsBusy ? <CircularProgress size={16} /> : "بارگیری آمار"}
                    </Button>
                    {stats ? (
                        <>
                            <Chip color="primary" label={`کل: ${fa(stats.total)}`} />
                            {Object.entries(stats.byStatus).map(([k, v]) => (
                                <Chip key={k} variant="outlined" label={`${k}: ${fa(v)}`} />
                            ))}
                            {stats.derived ? <Chip size="small" color="warning" variant="outlined" label="تخمینی" /> : null}
                        </>
                    ) : null}
                </Stack>
            </Section>

            <Section title="جستجوی محصولات باسلام">
                <Stack direction={{ xs: "column", sm: "row" }} gap={1}>
                    <TextField size="small" fullWidth placeholder="مثلاً: عسل" value={q}
                        onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && runSearch()} />
                    <Button variant="contained" disabled={searchBusy} onClick={runSearch}>
                        {searchBusy ? <CircularProgress size={18} /> : "جستجو"}
                    </Button>
                </Stack>
                {results.length ? (
                    <Stack gap={0.75} sx={{ mt: 1.5, maxHeight: 320, overflow: "auto" }}>
                        {results.slice(0, 30).map((r) => (
                            <Stack key={r.id} direction="row" gap={1} alignItems="center"
                                sx={{ p: 0.75, border: 1, borderColor: "divider", borderRadius: 1 }}>
                                <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }} noWrap>{r.name}</Typography>
                                <Chip size="small" label={`${fa(r.price)} ت`} />
                                <Chip size="small" color={r.stock > 0 ? "success" : "default"} label={`${fa(r.stock)}`} />
                            </Stack>
                        ))}
                    </Stack>
                ) : null}
            </Section>

            <Section title="تخفیف محصولات" desc="محصول‌ها را از لیست انتخاب کنید یا شناسه‌ها را دستی وارد کنید">
                <Stack gap={1.5}>
                    {/* Product picker */}
                    <Stack direction={{ xs: "column", sm: "row" }} gap={1}>
                        <TextField size="small" fullWidth placeholder="جستجوی محصول باسلام (نام/بارکد)" value={prodQ}
                            onChange={(e) => setProdQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && loadProducts()} />
                        <Button variant="outlined" disabled={prodBusy} onClick={loadProducts}>
                            {prodBusy ? <CircularProgress size={18} /> : "بارگیری"}
                        </Button>
                    </Stack>
                    {products.length ? (
                        <Stack gap={0.5} sx={{ maxHeight: 240, overflow: "auto" }}>
                            {products.map((p) => {
                                const id = Number(p.bslProductId);
                                if (!id) return null;
                                const active = Boolean(picked[id]);
                                return (
                                    <Stack key={p._id ?? id} direction="row" gap={1} alignItems="center"
                                        onClick={() => togglePick(id, p.displayName || String(id))}
                                        sx={{ p: 0.75, border: 1, borderColor: active ? "warning.main" : "divider", borderRadius: 1, cursor: "pointer", bgcolor: active ? "rgba(var(--mui-palette-warning-mainChannel) / 0.08)" : "transparent" }}>
                                        <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }} noWrap>{p.displayName || "—"}</Typography>
                                        <Typography variant="caption" color="text.secondary">#{id}</Typography>
                                        {active ? <Chip size="small" color="warning" label="انتخاب" /> : null}
                                    </Stack>
                                );
                            })}
                        </Stack>
                    ) : null}

                    {Object.keys(picked).length ? (
                        <Stack direction="row" gap={0.5} flexWrap="wrap">
                            {Object.entries(picked).map(([id, name]) => (
                                <Chip key={id} size="small" color="warning" variant="outlined" label={`${name} (#${id})`}
                                    onDelete={() => togglePick(Number(id), name)} />
                            ))}
                        </Stack>
                    ) : null}

                    <Grid container spacing={1} alignItems="flex-end">
                        <Grid size={{ xs: 12, sm: 7 }}>
                            <TextField size="small" fullWidth label="شناسهٔ دستی (اختیاری)" placeholder="123, 456" value={discIds}
                                onChange={(e) => setDiscIds(e.target.value)} />
                        </Grid>
                        <Grid size={{ xs: 6, sm: 3 }}>
                            <TextField size="small" fullWidth type="number" label="درصد تخفیف" value={discPercent}
                                onChange={(e) => setDiscPercent(e.target.value)} />
                        </Grid>
                        <Grid size={{ xs: 6, sm: 2 }}>
                            <Stack direction="row" gap={0.5}>
                                <Button size="small" variant="contained" color="warning" disabled={discBusy} onClick={applyDiscount}>اعمال</Button>
                                <Button size="small" variant="outlined" color="error" disabled={discBusy} onClick={removeDiscount}>حذف</Button>
                            </Stack>
                        </Grid>
                    </Grid>
                </Stack>
            </Section>

            <Section title="وب‌هوک سفارش" desc="باسلام را به گیرندهٔ سایت وصل می‌کند تا با هر رویداد، سفارش‌ها به‌روز شوند">
                <Stack gap={1}>
                    <Button size="small" variant="outlined" disabled={hookBusy} onClick={loadEvents}>
                        {hookBusy ? <CircularProgress size={16} /> : "بارگیری رویدادها"}
                    </Button>
                    {events.length ? (
                        <Stack direction="row" gap={0.75} flexWrap="wrap">
                            {events.map((ev) => {
                                const id = Number(ev.id ?? ev.value);
                                const active = selectedEvents.includes(id);
                                return (
                                    <Chip key={id} label={ev.name || ev.title || `رویداد ${id}`}
                                        color={active ? "primary" : "default"} variant={active ? "filled" : "outlined"}
                                        onClick={() => setSelectedEvents((prev) => active ? prev.filter((x) => x !== id) : [...prev, id])} />
                                );
                            })}
                        </Stack>
                    ) : null}
                    <Divider />
                    <Stack direction="row" gap={1} flexWrap="wrap">
                        <Button variant="contained" disabled={hookBusy || !selectedEvents.length} onClick={setupWebhook}>
                            راه‌اندازی وب‌هوک
                        </Button>
                        <Button variant="text" disabled={hookBusy} onClick={loadHooks}>
                            نمایش وب‌هوک‌های ثبت‌شده
                        </Button>
                    </Stack>

                    {hooks.length ? (
                        <Stack gap={0.5}>
                            {hooks.map((h) => {
                                const id = Number(h.id ?? h.webhook_id);
                                return (
                                    <Stack key={id} direction="row" gap={1} alignItems="center"
                                        sx={{ p: 0.75, border: 1, borderColor: "divider", borderRadius: 1 }}>
                                        <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }} noWrap>
                                            {h.url || `وب‌هوک #${id}`}
                                        </Typography>
                                        {h.is_active === false ? <Chip size="small" label="غیرفعال" /> : <Chip size="small" color="success" label="فعال" />}
                                        <Button size="small" color="error" disabled={hookBusy} onClick={() => deleteHook(id)}>حذف</Button>
                                    </Stack>
                                );
                            })}
                        </Stack>
                    ) : null}

                    <Alert severity="info" variant="outlined">
                        گیرنده: <code>/api/basalaam/webhook</code> — روی رویداد سفارش، سینک سفارش‌ها به‌صورت خودکار اجرا می‌شود.
                    </Alert>
                </Stack>
            </Section>
        </Stack>
    );
}
