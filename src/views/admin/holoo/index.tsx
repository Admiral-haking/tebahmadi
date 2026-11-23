"use client";

import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    CircularProgress,
    Divider,
    Stack,
    Tab,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TablePagination,
    LinearProgress,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TableHead,
    TableRow,
    Tabs,
    TextField,
    Typography,
} from "@mui/material";
import {
    AccountBalanceRounded,
    CheckCircleRounded,
    ErrorRounded,
    RefreshRounded,
    SyncRounded,
} from "@mui/icons-material";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

type Status = {
    configured: boolean;
    connected: boolean;
    message: string;
    dbname?: string;
    baseUrl?: string;
};

type HolooCustomer = { Code: string; Name: string; Mobile?: string; Mandeh?: string; ErpCode: string };
type HolooProduct = { Code: string; Name: string; Few?: string; SellPrice?: string; ErpCode: string };
type HolooInvoice = {
    Code: string;
    Type: string;
    CustomerName: string;
    Date: string;
    SumPrice: string;
    ErpCode: string;
};

async function api<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await fetch(url, { credentials: "same-origin", ...init });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data as any)?.error || `خطا (${res.status})`);
    return data as T;
}

export default function HolooHomeView() {
    const [status, setStatus] = useState<Status | null>(null);
    const [checking, setChecking] = useState(false);
    const [tab, setTab] = useState(0);

    const checkStatus = useCallback(async () => {
        setChecking(true);
        try {
            const res = await fetch("/api/holoo/status", { credentials: "same-origin" });
            setStatus(await res.json());
        } catch {
            setStatus({ configured: false, connected: false, message: "بررسی وضعیت ناموفق بود." });
        } finally {
            setChecking(false);
        }
    }, []);

    useEffect(() => {
        checkStatus();
    }, [checkStatus]);

    const connected = status?.connected;

    return (
        <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1100, mx: "auto" }}>
            <Stack direction="row" spacing={1.5} alignItems="center" mb={3}>
                <AccountBalanceRounded color="primary" />
                <Typography variant="h5" fontWeight={700}>
                    حسابداری هلو
                </Typography>
            </Stack>

            <Card variant="outlined" sx={{ mb: 3 }}>
                <CardContent>
                    <Stack
                        direction={{ xs: "column", sm: "row" }}
                        spacing={2}
                        justifyContent="space-between"
                        alignItems={{ sm: "center" }}
                    >
                        <Stack spacing={1}>
                            <Stack direction="row" spacing={1} alignItems="center">
                                <Typography fontWeight={600}>وضعیت اتصال:</Typography>
                                {checking ? (
                                    <CircularProgress size={18} />
                                ) : connected ? (
                                    <Chip
                                        icon={<CheckCircleRounded />}
                                        color="success"
                                        size="small"
                                        label="متصل"
                                    />
                                ) : (
                                    <Chip
                                        icon={<ErrorRounded />}
                                        color={status?.configured ? "error" : "warning"}
                                        size="small"
                                        label={status?.configured ? "اتصال ناموفق" : "تنظیم نشده"}
                                    />
                                )}
                            </Stack>
                            <Typography variant="body2" color="text.secondary">
                                {status?.message}
                            </Typography>
                            {status?.baseUrl && (
                                <Typography variant="caption" color="text.secondary">
                                    {status.baseUrl} • دیتابیس: {status.dbname}
                                </Typography>
                            )}
                        </Stack>
                        <Button
                            variant="outlined"
                            startIcon={<RefreshRounded />}
                            onClick={checkStatus}
                            disabled={checking}
                        >
                            بررسی مجدد
                        </Button>
                    </Stack>
                    {status && !status.configured && (
                        <Alert severity="info" sx={{ mt: 2 }}>
                            متغیرهای محیطی <code>HOLOO_BASE_URL</code>، <code>HOLOO_USERNAME</code>،{" "}
                            <code>HOLOO_PASSWORD</code> و <code>HOLOO_DBNAME</code> را در پیکربندی سایت تنظیم
                            کنید.
                        </Alert>
                    )}
                </CardContent>
            </Card>

            <SyncInvoicePanel disabled={!connected} />

            <Card variant="outlined">
                <Tabs
                    value={tab}
                    onChange={(_, v) => setTab(v)}
                    variant="scrollable"
                    sx={{ borderBottom: 1, borderColor: "divider" }}
                >
                    <Tab label="داشبورد" />
                    <Tab label="فاکتورهای فروشگاه" />
                    <Tab label="طرف‌حساب‌ها" />
                    <Tab label="کالاها" />
                    <Tab label="نگاشت کالاها" />
                    <Tab label="اسناد مالی" />
                    <Tab label="اسناد فروش" />
                    <Tab label="فاکتورهای هلو" />
                    <Tab label="سلامت کالاها" />
                </Tabs>
                <CardContent>
                    {!connected ? (
                        <Typography color="text.secondary" textAlign="center" py={4}>
                            برای مشاهده اطلاعات، ابتدا اتصال به هلو برقرار شود.
                        </Typography>
                    ) : tab === 0 ? (
                        <ReportsTab />
                    ) : tab === 1 ? (
                        <StoreInvoicesTab />
                    ) : tab === 2 ? (
                        <CustomersTab />
                    ) : tab === 3 ? (
                        <ProductsTab />
                    ) : tab === 4 ? (
                        <ProductMappingTab />
                    ) : tab === 5 ? (
                        <PaymentsTab />
                    ) : tab === 6 ? (
                        <SalesDocsTab />
                    ) : tab === 7 ? (
                        <InvoicesTab />
                    ) : (
                        <ReconcileTab />
                    )}
                </CardContent>
            </Card>
        </Box>
    );
}

type StoreInvoiceLine = {
    title: string;
    qty: number;
    unitPrice: number; // تومان
    lineTotal: number; // تومان
};

type StoreInvoiceType = "sale" | "return" | "marketplace";

type StoreInvoice = {
    id: string;
    type: StoreInvoiceType;
    channel: string; // سایت / دیجی‌کالا قلب دوم / ...
    number: string;
    customer: string;
    phone: string;
    amount: number; // تومان (grandTotal)
    shippingTotal: number; // تومان
    discountTotal: number; // تومان
    lines: StoreInvoiceLine[];
    createdAt: string | null;
    paymentMethod: string;
    synced: boolean;
    erpcode: string;
    holooNumber: string;
    syncedAt: number | null;
};

/** Format a ریال amount as تومان (÷۱۰). Use for Holoo data, which is in ریال. */
function toman(rial: number): string {
    return Math.round((rial || 0) / 10).toLocaleString("fa-IR");
}

/**
 * Format an amount that is ALREADY in تومان (the site's unit, e.g. InvoiceModel
 * grandTotal / line prices) — no division. Avoids the 10× understatement bug.
 */
function tomanAmount(toman: number): string {
    return Math.round(toman || 0).toLocaleString("fa-IR");
}

function faDate(iso: string | null): string {
    if (!iso) return "—";
    try {
        return new Intl.DateTimeFormat("fa-IR-u-ca-persian", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
    } catch {
        return "—";
    }
}

type HReport = { Code: string; Name: string; Price: string; Few?: number };

function compactToman(rial: number): string {
    const t = Math.round((rial || 0) / 10);
    const abs = Math.abs(t);
    const sign = t < 0 ? "−" : "";
    if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(2)} میلیارد`;
    if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(1)} میلیون`;
    return `${sign}${abs.toLocaleString("fa-IR")}`;
}

function MiniReport({ title, rows, value, color }: {
    title: string;
    rows: HReport[];
    value: (r: HReport) => string;
    color?: string;
}) {
    return (
        <Card variant="outlined" sx={{ flex: "1 1 320px", minWidth: 280 }}>
            <CardContent>
                <Typography fontWeight={700} mb={1}>{title}</Typography>
                {!rows.length ? (
                    <Typography variant="caption" color="text.secondary">داده‌ای نیست.</Typography>
                ) : (
                    <Stack spacing={0.75}>
                        {rows.map((r, i) => (
                            <Stack key={`${r.Code}-${i}`} direction="row" justifyContent="space-between" alignItems="center" gap={1}>
                                <Typography variant="body2" noWrap title={r.Name} sx={{ maxWidth: "60%" }}>{r.Name}</Typography>
                                <Typography variant="body2" fontWeight={600} color={color} sx={{ whiteSpace: "nowrap" }}>{value(r)}</Typography>
                            </Stack>
                        ))}
                    </Stack>
                )}
            </CardContent>
        </Card>
    );
}

function ReportsTab() {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<Record<string, HReport[]>>({});

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const today = new Date().toISOString().slice(0, 10);
            const yearAgo = new Date(Date.now() - 365 * 864e5).toISOString().slice(0, 10);
            const dated = new Set(["maxSelFewProduct", "maxSelPriceProduct", "minSelFewProduct", "minSelPriceProduct"]);
            const types = ["cash", "account", "maxBedCustomer", "maxBesCustomer", "maxFewProduct", "minFewProduct", "maxSelFewProduct", "maxSelPriceProduct", "minSelFewProduct", "minSelPriceProduct"];
            const results = await Promise.all(
                types.map(async (t) => {
                    try {
                        const params = new URLSearchParams({ type: t });
                        if (t.startsWith("max") || t.startsWith("min")) params.set("count", "8");
                        if (dated.has(t)) { params.set("date.from", yearAgo); params.set("date.to", today); }
                        const res = await api<{ data: { report?: HReport[] } }>(`/api/holoo/reports?${params.toString()}`);
                        return [t, res.data?.report ?? []] as const;
                    } catch {
                        return [t, [] as HReport[]] as const;
                    }
                }),
            );
            setData(Object.fromEntries(results));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    if (loading) {
        return <Box textAlign="center" py={5}><CircularProgress size={30} /></Box>;
    }

    const sum = (rows: HReport[]) => (rows || []).reduce((s, r) => s + Number(r.Price || 0), 0);
    const cashTotal = sum(data.cash);
    const bankTotal = sum(data.account);

    return (
        <Stack spacing={2.5}>
            <Box>
                <Button variant="outlined" size="small" startIcon={<RefreshRounded />} onClick={load}>به‌روزرسانی</Button>
            </Box>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <Card variant="outlined" sx={{ flex: 1, bgcolor: "rgba(var(--mui-palette-success-mainChannel) / 0.06)" }}>
                    <CardContent>
                        <Typography variant="caption" color="text.secondary">مجموع موجودی صندوق‌ها</Typography>
                        <Typography variant="h6" fontWeight={800} color={cashTotal < 0 ? "error.main" : "success.main"}>
                            {compactToman(cashTotal)} ت
                        </Typography>
                        <Typography variant="caption" color="text.secondary">{(data.cash?.length || 0).toLocaleString("fa-IR")} صندوق</Typography>
                    </CardContent>
                </Card>
                <Card variant="outlined" sx={{ flex: 1, bgcolor: "rgba(var(--mui-palette-primary-mainChannel) / 0.06)" }}>
                    <CardContent>
                        <Typography variant="caption" color="text.secondary">مجموع موجودی بانک‌ها</Typography>
                        <Typography variant="h6" fontWeight={800} color={bankTotal < 0 ? "error.main" : "primary.main"}>
                            {compactToman(bankTotal)} ت
                        </Typography>
                        <Typography variant="caption" color="text.secondary">{(data.account?.length || 0).toLocaleString("fa-IR")} حساب</Typography>
                    </CardContent>
                </Card>
            </Stack>

            <Stack direction="row" flexWrap="wrap" gap={2}>
                <MiniReport title="بدهکارترین طرف‌حساب‌ها" rows={data.maxBedCustomer || []} value={(r) => `${compactToman(Number(r.Price))} ت`} color="error.main" />
                <MiniReport title="بستانکارترین طرف‌حساب‌ها" rows={data.maxBesCustomer || []} value={(r) => `${compactToman(Number(r.Price))} ت`} color="success.main" />
                <MiniReport title="بیشترین موجودی کالا" rows={data.maxFewProduct || []} value={(r) => `${Number(r.Few ?? 0).toLocaleString("fa-IR")} عدد`} color="primary.main" />
                <MiniReport title="کسری / کم‌موجودی کالا" rows={data.minFewProduct || []} value={(r) => `${Number(r.Few ?? 0).toLocaleString("fa-IR")} عدد`} color="error.main" />
            </Stack>

            <Stack direction="row" flexWrap="wrap" gap={2}>
                <MiniReport title="پرفروش‌ترین کالاها (تعدادی، یک سال اخیر)" rows={data.maxSelFewProduct || []} value={(r) => `${Number(r.Few ?? 0).toLocaleString("fa-IR")} عدد`} color="success.main" />
                <MiniReport title="پرفروش‌ترین کالاها (مبلغی، یک سال اخیر)" rows={data.maxSelPriceProduct || []} value={(r) => `${compactToman(Number(r.Price))} ت`} color="success.main" />
            </Stack>

            <Stack direction="row" flexWrap="wrap" gap={2}>
                <MiniReport title="کم‌فروش‌ترین کالاها (تعدادی)" rows={data.minSelFewProduct || []} value={(r) => `${Number(r.Few ?? 0).toLocaleString("fa-IR")} عدد`} color="text.secondary" />
                <MiniReport title="کم‌فروش‌ترین کالاها (مبلغی)" rows={data.minSelPriceProduct || []} value={(r) => `${compactToman(Number(r.Price))} ت`} color="text.secondary" />
            </Stack>

            <Stack direction="row" flexWrap="wrap" gap={2}>
                <MiniReport title="موجودی صندوق‌ها" rows={data.cash || []} value={(r) => `${compactToman(Number(r.Price))} ت`} />
                <MiniReport title="موجودی بانک‌ها" rows={data.account || []} value={(r) => `${compactToman(Number(r.Price))} ت`} />
            </Stack>

            <ReportQuery />
        </Stack>
    );
}

function ReportQuery() {
    const [type, setType] = useState<"sarfasl" | "custPay" | "kardexSarfasl">("sarfasl");
    const [code, setCode] = useState("");
    const [rows, setRows] = useState<Record<string, unknown>[]>([]);
    const [loading, setLoading] = useState(false);

    async function run() {
        setLoading(true);
        try {
            const params = new URLSearchParams({ type });
            if (code.trim()) params.set("code", code.trim());
            if (type === "kardexSarfasl") params.set("count", "20");
            const res = await api<{ data: { report?: Record<string, unknown> | Record<string, unknown>[] } }>(`/api/holoo/reports?${params.toString()}`);
            const rep = res.data?.report;
            setRows(Array.isArray(rep) ? rep : rep ? [rep] : []);
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setLoading(false);
        }
    }

    const head = type === "kardexSarfasl" ? ["کد", "تاریخ", "بدهکار", "بستانکار", "شرح"]
        : type === "custPay" ? ["کد", "نام", "مبلغ", "تاریخ", "مانده"]
            : ["کد", "نام", "مبلغ"];
    const toRow = (r: Record<string, unknown>): (string | number)[] => type === "kardexSarfasl"
        ? [String(r.Code ?? ""), String(r.Date ?? ""), String(r.Bed ?? ""), String(r.Bes ?? ""), String(r.Comment ?? "")]
        : type === "custPay"
            ? [String(r.Code ?? ""), String(r.Name ?? ""), String(r.Price ?? ""), String(r.Date ?? ""), String(r.Mandeh ?? "")]
            : [String(r.Code ?? ""), String(r.Name ?? ""), String(r.Price ?? "")];

    return (
        <Card variant="outlined">
            <CardContent>
                <Typography fontWeight={700} mb={1}>گزارش‌های پرس‌وجویی</Typography>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ sm: "center" }}>
                    <TextField size="small" select SelectProps={{ native: true }} label="نوع گزارش" value={type} onChange={(e) => { setType(e.target.value as typeof type); setRows([]); }} sx={{ minWidth: 200 }}>
                        <option value="sarfasl">سرفصل حسابداری</option>
                        <option value="custPay">آخرین پرداختی طرف‌حساب</option>
                        <option value="kardexSarfasl">کاردکس سرفصل</option>
                    </TextField>
                    <TextField size="small" fullWidth label="کد سرفصل/طرف‌حساب" value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => e.key === "Enter" && run()} />
                    <Button variant="contained" onClick={run} disabled={loading}>{loading ? <CircularProgress size={18} color="inherit" /> : "اجرا"}</Button>
                </Stack>
                <Box mt={1.5}>
                    <SimpleTable loading={loading} head={head} rows={rows.map(toRow)} />
                </Box>
            </CardContent>
        </Card>
    );
}

function StoreInvoicesTab() {
    const [rows, setRows] = useState<StoreInvoice[]>([]);
    const [loading, setLoading] = useState(false);
    const [filter, setFilter] = useState<"all" | "synced" | "pending">("all");
    const [typeFilter, setTypeFilter] = useState<"all" | StoreInvoiceType>("all");
    const [q, setQ] = useState("");
    const [page, setPage] = useState(1);
    const [pager, setPager] = useState<{ total: number; totalPages: number }>({ total: 0, totalPages: 1 });
    const [syncedTotal, setSyncedTotal] = useState(0);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [bulkBusy, setBulkBusy] = useState(false);
    const [detail, setDetail] = useState<StoreInvoice | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ page: String(page), size: "30", filter, type: typeFilter });
            if (q.trim()) params.set("q", q.trim());
            const res = await api<{ items: StoreInvoice[]; syncedTotal: number; pager: { total: number; totalPages: number } }>(
                `/api/holoo/synced-invoices?${params.toString()}`,
            );
            setRows(res.items || []);
            setPager(res.pager || { total: 0, totalPages: 1 });
            setSyncedTotal(res.syncedTotal || 0);
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setLoading(false);
        }
    }, [page, filter, typeFilter, q]);

    useEffect(() => {
        load();
    }, [page, filter, typeFilter]);

    async function bulkSync() {
        setBulkBusy(true);
        try {
            const res = await api<{ processed: number; succeeded: number; results: Array<{ skipped?: string }> }>(
                "/api/holoo/sync-invoice/bulk",
                { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" },
            );
            if (res.processed === 0) toast.info("فاکتور ثبت‌نشده‌ای باقی نمانده است.");
            else toast.success(`${res.succeeded.toLocaleString("fa-IR")} از ${res.processed.toLocaleString("fa-IR")} فاکتور در هلو ثبت شد.`);
            load();
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setBulkBusy(false);
        }
    }

    async function syncOne(inv: StoreInvoice) {
        // Route to the right Holoo sync endpoint based on the row type.
        const route =
            inv.type === "marketplace"
                ? { url: "/api/holoo/sync-tracker", body: { trackerId: inv.id } }
                : inv.type === "return"
                ? { url: "/api/holoo/sync-return", body: { invoiceId: inv.id } }
                : { url: "/api/holoo/sync-invoice", body: { invoiceId: inv.id } };
        setBusyId(inv.id);
        try {
            const res = await api<{ ok: boolean; erpcode?: string; skipped?: string; detail?: unknown }>(
                route.url,
                { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(route.body) },
            );
            if (res.ok) {
                toast.success(`${inv.number} در هلو ثبت شد (ErpCode: ${res.erpcode})`);
                load();
            } else {
                const reasons: Record<string, string> = {
                    not_paid: "فاکتور پرداخت‌نشده است",
                    not_canceled_or_refunded: "فاکتور برگشتی/لغوشده نیست",
                    unsupported_service: "این سرویس پشتیبانی نمی‌شود",
                    no_valid_items: "قلم معتبری برای ثبت نیست",
                    not_found: "مورد یافت نشد",
                    not_configured: "هلو تنظیم نشده",
                    missing_products: `کالاهای بدون نگاشت در هلو: ${Array.isArray(res.detail) ? res.detail.join("، ") : ""}`,
                    error: "خطا در ثبت",
                };
                toast.warning(`ثبت نشد: ${reasons[res.skipped || ""] || res.skipped}`);
            }
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setBusyId(null);
        }
    }

    return (
        <Stack spacing={2}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ sm: "center" }} justifyContent="space-between">
                <Stack spacing={1}>
                    <Stack direction="row" spacing={1} flexWrap="wrap">
                        {(["all", "pending", "synced"] as const).map((f) => (
                            <Chip
                                key={f}
                                label={f === "all" ? "همه" : f === "pending" ? "ثبت‌نشده" : "ثبت‌شده در هلو"}
                                color={filter === f ? "primary" : "default"}
                                variant={filter === f ? "filled" : "outlined"}
                                onClick={() => { setPage(1); setFilter(f); }}
                                size="small"
                            />
                        ))}
                    </Stack>
                    <Stack direction="row" spacing={1} flexWrap="wrap">
                        {(["all", "sale", "return", "marketplace"] as const).map((t) => (
                            <Chip
                                key={t}
                                label={t === "all" ? "همه انواع" : t === "sale" ? "فروش سایت" : t === "return" ? "برگشت" : "مارکت‌پلیس"}
                                color={typeFilter === t ? "secondary" : "default"}
                                variant={typeFilter === t ? "filled" : "outlined"}
                                onClick={() => { setPage(1); setTypeFilter(t); }}
                                size="small"
                            />
                        ))}
                    </Stack>
                </Stack>
                <Stack direction="row" spacing={1.5} alignItems="center">
                    <Typography variant="caption" color="text.secondary">
                        {syncedTotal.toLocaleString("fa-IR")} فاکتور تا کنون در هلو ثبت شده
                    </Typography>
                    <Button
                        size="small"
                        variant="contained"
                        color="secondary"
                        startIcon={bulkBusy ? <CircularProgress size={14} color="inherit" /> : <SyncRounded fontSize="small" />}
                        onClick={bulkSync}
                        disabled={bulkBusy}
                    >
                        ثبت دسته‌ای (۲۵ تای بعدی)
                    </Button>
                </Stack>
            </Stack>

            <SearchBar value={q} onChange={setQ} onSearch={() => { setPage(1); load(); }} loading={loading} placeholder="شماره فاکتور، نام یا موبایل مشتری" />
            <Divider />

            {loading ? (
                <Box textAlign="center" py={4}><CircularProgress size={28} /></Box>
            ) : !rows.length ? (
                <Typography color="text.secondary" textAlign="center" py={4}>فاکتوری برای نمایش نیست.</Typography>
            ) : (
                <TableContainer>
                    <Table size="small">
                        <TableHead>
                            <TableRow sx={{ "& th": { fontWeight: 700 } }}>
                                <TableCell>نوع / پلتفرم</TableCell>
                                <TableCell>شماره</TableCell>
                                <TableCell>مشتری</TableCell>
                                <TableCell>مبلغ (تومان)</TableCell>
                                <TableCell>تاریخ</TableCell>
                                <TableCell>وضعیت هلو</TableCell>
                                <TableCell align="center">عملیات</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {rows.map((r) => (
                                <TableRow key={r.id} hover>
                                    <TableCell>
                                        <Stack spacing={0.25}>
                                            <Chip
                                                size="small"
                                                variant="outlined"
                                                color={r.type === "return" ? "error" : r.type === "marketplace" ? "info" : "default"}
                                                label={r.type === "return" ? "برگشت" : r.type === "marketplace" ? "مارکت‌پلیس" : "فروش سایت"}
                                                sx={{ width: "fit-content" }}
                                            />
                                            <Typography variant="caption" color="text.secondary">{r.channel}</Typography>
                                        </Stack>
                                    </TableCell>
                                    <TableCell sx={{ fontFamily: "monospace" }}>{r.number}</TableCell>
                                    <TableCell>
                                        <Typography variant="body2">{r.customer}</Typography>
                                        {r.phone && <Typography variant="caption" color="text.secondary">{r.phone}</Typography>}
                                    </TableCell>
                                    <TableCell>{tomanAmount(r.amount)}</TableCell>
                                    <TableCell><Typography variant="caption" color="text.secondary">{faDate(r.createdAt)}</Typography></TableCell>
                                    <TableCell>
                                        {r.synced ? (
                                            <Stack spacing={0.25}>
                                                <Chip size="small" color="success" icon={<CheckCircleRounded />} label={`ثبت‌شده${r.holooNumber ? ` • فاکتور ${r.holooNumber}` : ""}`} sx={{ width: "fit-content" }} />
                                                {r.syncedAt && <Typography variant="caption" color="text.secondary">{faDate(new Date(r.syncedAt).toISOString())}</Typography>}
                                            </Stack>
                                        ) : (
                                            <Chip size="small" color="warning" variant="outlined" label="ثبت‌نشده" />
                                        )}
                                    </TableCell>
                                    <TableCell align="center">
                                        <Stack direction="row" spacing={0.5} justifyContent="center">
                                            <Button size="small" variant="text" onClick={() => setDetail(r)}>
                                                اقلام
                                            </Button>
                                            <Button
                                                size="small"
                                                variant={r.synced ? "text" : "contained"}
                                                startIcon={busyId === r.id ? <CircularProgress size={14} color="inherit" /> : <SyncRounded fontSize="small" />}
                                                onClick={() => syncOne(r)}
                                                disabled={busyId === r.id}
                                            >
                                                {r.synced ? "ثبت مجدد" : "ثبت در هلو"}
                                            </Button>
                                        </Stack>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

            {pager.totalPages > 1 && (
                <Stack direction="row" spacing={1} justifyContent="center" alignItems="center">
                    <Button size="small" disabled={page <= 1 || loading} onClick={() => setPage((p) => Math.max(1, p - 1))}>قبلی</Button>
                    <Typography variant="caption">صفحه {page.toLocaleString("fa-IR")} از {pager.totalPages.toLocaleString("fa-IR")}</Typography>
                    <Button size="small" disabled={page >= pager.totalPages || loading} onClick={() => setPage((p) => p + 1)}>بعدی</Button>
                </Stack>
            )}

            <InvoiceDetailDialog invoice={detail} onClose={() => setDetail(null)} />
        </Stack>
    );
}

/** Read-only dialog showing an invoice's line items. All prices are تومان. */
function InvoiceDetailDialog({ invoice, onClose }: { invoice: StoreInvoice | null; onClose: () => void }) {
    return (
        <Dialog open={Boolean(invoice)} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle>
                اقلام فاکتور {invoice?.number ?? ""}
                {invoice?.customer ? ` — ${invoice.customer}` : ""}
            </DialogTitle>
            <DialogContent dividers>
                {!invoice?.lines?.length ? (
                    <Typography color="text.secondary" textAlign="center" py={3}>قلمی ثبت نشده است.</Typography>
                ) : (
                    <TableContainer>
                        <Table size="small">
                            <TableHead>
                                <TableRow sx={{ "& th": { fontWeight: 700 } }}>
                                    <TableCell>کالا</TableCell>
                                    <TableCell align="center">تعداد</TableCell>
                                    <TableCell align="left">قیمت واحد (تومان)</TableCell>
                                    <TableCell align="left">جمع قلم (تومان)</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {invoice.lines.map((l, i) => (
                                    <TableRow key={i} hover>
                                        <TableCell>{l.title}</TableCell>
                                        <TableCell align="center">{l.qty.toLocaleString("fa-IR")}</TableCell>
                                        <TableCell align="left">{l.unitPrice > 0 ? tomanAmount(l.unitPrice) : "—"}</TableCell>
                                        <TableCell align="left">{l.lineTotal > 0 ? tomanAmount(l.lineTotal) : "—"}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}
                {invoice && (
                    <Stack spacing={0.5} mt={2} alignItems="flex-end">
                        {invoice.shippingTotal > 0 && (
                            <Typography variant="body2" color="text.secondary">
                                هزینه ارسال: {tomanAmount(invoice.shippingTotal)} تومان
                            </Typography>
                        )}
                        {invoice.discountTotal > 0 && (
                            <Typography variant="body2" color="text.secondary">
                                تخفیف: {tomanAmount(invoice.discountTotal)} تومان
                            </Typography>
                        )}
                        <Typography variant="subtitle2" fontWeight={700}>
                            مبلغ کل: {tomanAmount(invoice.amount)} تومان
                        </Typography>
                        {invoice.type === "marketplace" && (
                            <Typography variant="caption" color="text.secondary">
                                در سفارش‌های مارکت‌پلیس قیمت تک‌تک اقلام ذخیره نمی‌شود؛ فقط تعداد و مبلغ کل سفارش موجود است.
                            </Typography>
                        )}
                    </Stack>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>بستن</Button>
            </DialogActions>
        </Dialog>
    );
}

function SyncInvoicePanel({ disabled }: { disabled: boolean }) {
    const [invoiceId, setInvoiceId] = useState("");
    const [busy, setBusy] = useState(false);

    async function post(endpoint: string, successMsg: string) {
        if (!invoiceId.trim()) return;
        setBusy(true);
        try {
            const res = await api<{ ok: boolean; erpcode?: string; skipped?: string }>(
                endpoint,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ invoiceId: invoiceId.trim() }),
                },
            );
            if (res.ok) toast.success(`${successMsg} (ErpCode: ${res.erpcode})`);
            else toast.warning(`انجام نشد: ${res.skipped}`);
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setBusy(false);
        }
    }

    function sync() {
        return post("/api/holoo/sync-invoice", "فاکتور در هلو ثبت شد");
    }

    function resync() {
        if (
            !window.confirm(
                "این کار فاکتور قبلی در هلو را با یک «برگشت از فروش» ابطال می‌کند و " +
                "فاکتور فروش جدید با مقادیر فعلی ثبت می‌کند. ادامه می‌دهید؟",
            )
        )
            return;
        return post("/api/holoo/resync-invoice", "فاکتور اصلاح و دوباره ثبت شد");
    }

    return (
        <Card variant="outlined" sx={{ mb: 3 }}>
            <CardContent>
                <Typography fontWeight={600} mb={0.5}>
                    ثبت دستی فاکتور فروشگاه در هلو
                </Typography>
                <Typography variant="body2" color="text.secondary" mb={2}>
                    شناسه (id) فاکتور پرداخت‌شده فروشگاه را وارد کنید تا به‌صورت فاکتور فروش در هلو ثبت شود
                    (برای تلاش مجدد فاکتورهایی که خودکار ثبت نشده‌اند).
                </Typography>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                    <TextField
                        size="small"
                        fullWidth
                        placeholder="Invoice ID"
                        value={invoiceId}
                        onChange={(e) => setInvoiceId(e.target.value)}
                        disabled={disabled || busy}
                    />
                    <Button
                        variant="contained"
                        startIcon={busy ? <CircularProgress size={16} color="inherit" /> : <SyncRounded />}
                        onClick={sync}
                        disabled={disabled || busy || !invoiceId.trim()}
                    >
                        ثبت در هلو
                    </Button>
                    <Button
                        variant="outlined"
                        color="warning"
                        onClick={resync}
                        disabled={disabled || busy || !invoiceId.trim()}
                    >
                        اصلاح و ارسال مجدد
                    </Button>
                </Stack>
                <Typography variant="caption" color="text.secondary" mt={1} display="block">
                    «اصلاح و ارسال مجدد» برای فاکتوری که قبلاً در هلو ثبت شده: ابتدا با یک
                    برگشت از فروش ابطال و سپس با مقادیر فعلی دوباره ثبت می‌شود.
                </Typography>
            </CardContent>
        </Card>
    );
}

function CustomersTab() {
    const [code, setCode] = useState("");
    const [rows, setRows] = useState<HolooCustomer[]>([]);
    const [loading, setLoading] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({ name: "", mobile: "", code: "", custtype: "0", ispurchaser: true, isseller: false, Credit: "", nationalid: "", address: "" });
    const [saving, setSaving] = useState(false);
    const [editErp, setEditErp] = useState<string>("");

    // Marketplace panel → Holoo customer mapping
    type Panel = { channel: string; vendorId: string; key: string; count: number };
    const [panels, setPanels] = useState<Panel[]>([]);
    const [custOptions, setCustOptions] = useState<{ Name: string; ErpCode: string }[]>([]);
    const [vendorMap, setVendorMap] = useState<Record<string, string>>({});

    const CHANNEL_FA: Record<string, string> = { site: "سایت", digikala: "دیجی‌کالا", basalaam: "باسلام", snapp: "اسنپ‌شاپ" };

    async function load() {
        setLoading(true);
        try {
            const q = code.trim() ? `?code=${encodeURIComponent(code.trim())}` : "";
            const res = await api<{ customers: HolooCustomer[] }>(`/api/holoo/customers${q}`);
            setRows(res.customers || []);
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setLoading(false);
        }
    }

    async function loadVendorMap() {
        try {
            const res = await api<{
                panels: Panel[];
                customers: { Name: string; ErpCode: string }[];
                map: Record<string, string>;
            }>("/api/holoo/vendor-map");
            setPanels(res.panels || []);
            setCustOptions(res.customers || []);
            setVendorMap(res.map || {});
        } catch { /* ignore */ }
    }

    async function saveVendor(key: string, erp: string) {
        setVendorMap((m) => {
            const next = { ...m };
            if (erp) next[key] = erp; else delete next[key];
            return next;
        });
        try {
            await api("/api/holoo/vendor-map", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key, erpcode: erp }) });
        } catch (e: any) {
            toast.error(e.message);
        }
    }

    useEffect(() => { load(); loadVendorMap(); }, []);

    function resetForm() {
        setForm({ name: "", mobile: "", code: "", custtype: "0", ispurchaser: true, isseller: false, Credit: "", nationalid: "", address: "" });
        setEditErp("");
    }

    function startEdit(c: HolooCustomer) {
        setForm({ name: c.Name || "", mobile: c.Mobile || "", code: c.Code || "", custtype: "0", ispurchaser: true, isseller: false, Credit: "", nationalid: "", address: "" });
        setEditErp(c.ErpCode);
        setShowForm(true);
    }

    async function save() {
        if (!form.name.trim()) { toast.error("نام طرف‌حساب الزامی است"); return; }
        setSaving(true);
        try {
            const payload: Record<string, unknown> = {
                name: form.name.trim(),
                mobile: form.mobile.trim() || undefined,
                code: form.code.trim() || undefined,
                custtype: Number(form.custtype) === 1 ? 1 : 0,
                ispurchaser: form.ispurchaser,
                isseller: form.isseller,
                Credit: form.Credit ? Number(form.Credit) : undefined,
                nationalid: form.nationalid.trim() || undefined,
                address: form.address.trim() || undefined,
            };
            const res = await api<{ success: boolean; ErpCode?: string }>("/api/holoo/customers", {
                method: editErp ? "PUT" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(editErp ? { ...payload, erpcode: editErp } : payload),
            });
            toast.success(editErp ? "طرف‌حساب ویرایش شد" : `طرف‌حساب ثبت شد (ErpCode: ${res.ErpCode})`);
            resetForm();
            setShowForm(false);
            load();
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setSaving(false);
        }
    }

    return (
        <Stack spacing={2}>
            <Card variant="outlined">
                <CardContent>
                    <Typography fontWeight={700} mb={0.5}>اتصالِ پنلِ مارکت‌پلیس به طرف‌حساب</Typography>
                    <Typography variant="body2" color="text.secondary" mb={1.5}>
                        هر پنلِ فروشنده (مثلِ دیجی‌کالا «قلب دوم») را به یک طرف‌حسابِ هلو وصل کنید تا فاکتورهای آن پنل به همان طرف‌حساب بروند. اگر وصل نشود، طرف‌حساب به‌صورتِ خودکار بر اساسِ نامِ پنل ساخته می‌شود.
                    </Typography>
                    {panels.length > 0 ? (
                        <TableContainer sx={{ maxHeight: 320 }}>
                            <Table size="small" stickyHeader>
                                <TableHead>
                                    <TableRow sx={{ "& th": { fontWeight: 700 } }}>
                                        <TableCell>کانال</TableCell>
                                        <TableCell>پنل (vendor)</TableCell>
                                        <TableCell align="center">سفارش‌ها</TableCell>
                                        <TableCell>طرف‌حسابِ هلو</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {panels.map((p) => (
                                        <TableRow key={p.key} hover>
                                            <TableCell>{CHANNEL_FA[p.channel] || p.channel}</TableCell>
                                            <TableCell>{p.vendorId || "—"}</TableCell>
                                            <TableCell align="center">{p.count.toLocaleString("fa-IR")}</TableCell>
                                            <TableCell>
                                                <TextField size="small" select SelectProps={{ native: true }} value={vendorMap[p.key] || ""}
                                                    onChange={(e) => saveVendor(p.key, e.target.value)} sx={{ minWidth: 280 }}>
                                                    <option value="">— خودکار (بر اساس نام) —</option>
                                                    {custOptions.map((c) => <option key={c.ErpCode} value={c.ErpCode}>{c.Name}</option>)}
                                                </TextField>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    ) : (
                        <Typography variant="caption" color="text.secondary">هنوز سفارشی از پنل‌های مارکت‌پلیس ثبت نشده.</Typography>
                    )}
                </CardContent>
            </Card>

            <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
                <Box flex={1}><SearchBar value={code} onChange={setCode} onSearch={load} loading={loading} placeholder="کد طرف‌حساب (اختیاری)" /></Box>
                <Button variant={showForm ? "outlined" : "contained"} onClick={() => { if (showForm) resetForm(); setShowForm((s) => !s); }}>
                    {showForm ? "بستن فرم" : "افزودن طرف‌حساب"}
                </Button>
            </Stack>

            {showForm && (
                <Card variant="outlined">
                    <CardContent>
                        <Stack spacing={1.5}>
                            {editErp && <Typography variant="caption" color="primary.main">ویرایش طرف‌حساب (ErpCode: {editErp})</Typography>}
                            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                                <TextField size="small" fullWidth label="نام *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                                <TextField size="small" fullWidth label="موبایل" value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} />
                                <TextField size="small" fullWidth label="کد (اختیاری)" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
                            </Stack>
                            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                                <TextField size="small" fullWidth select SelectProps={{ native: true }} label="نوع" value={form.custtype} onChange={(e) => setForm({ ...form, custtype: e.target.value })}>
                                    <option value="0">بدهکار</option>
                                    <option value="1">بستانکار</option>
                                </TextField>
                                <TextField size="small" fullWidth label="حد اعتبار (ریال)" type="number" value={form.Credit} onChange={(e) => setForm({ ...form, Credit: e.target.value })} />
                                <TextField size="small" fullWidth label="کد ملی" value={form.nationalid} onChange={(e) => setForm({ ...form, nationalid: e.target.value })} />
                            </Stack>
                            <TextField size="small" fullWidth label="آدرس" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
                            <Stack direction="row" spacing={2} alignItems="center">
                                <Chip label="خریدار" color={form.ispurchaser ? "primary" : "default"} variant={form.ispurchaser ? "filled" : "outlined"} onClick={() => setForm({ ...form, ispurchaser: !form.ispurchaser })} size="small" />
                                <Chip label="فروشنده" color={form.isseller ? "primary" : "default"} variant={form.isseller ? "filled" : "outlined"} onClick={() => setForm({ ...form, isseller: !form.isseller })} size="small" />
                                <Box flex={1} />
                                <Button variant="contained" onClick={save} disabled={saving} startIcon={saving ? <CircularProgress size={16} color="inherit" /> : undefined}>
                                    {editErp ? "ذخیره ویرایش" : "ثبت در هلو"}
                                </Button>
                            </Stack>
                        </Stack>
                    </CardContent>
                </Card>
            )}

            <Divider />
            {loading ? (
                <Box textAlign="center" py={4}><CircularProgress size={28} /></Box>
            ) : !rows.length ? (
                <Typography color="text.secondary" textAlign="center" py={4}>موردی برای نمایش نیست.</Typography>
            ) : (
                <TableContainer>
                    <Table size="small">
                        <TableHead>
                            <TableRow sx={{ "& th": { fontWeight: 700 } }}>
                                <TableCell>کد</TableCell><TableCell>نام</TableCell><TableCell>موبایل</TableCell>
                                <TableCell>مانده</TableCell><TableCell>ErpCode</TableCell><TableCell align="center">ویرایش</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {rows.map((c) => (
                                <TableRow key={c.ErpCode} hover>
                                    <TableCell>{c.Code}</TableCell>
                                    <TableCell>{c.Name}</TableCell>
                                    <TableCell>{c.Mobile || "—"}</TableCell>
                                    <TableCell>{c.Mandeh || "—"}</TableCell>
                                    <TableCell sx={{ fontFamily: "monospace" }}>{c.ErpCode}</TableCell>
                                    <TableCell align="center"><Button size="small" onClick={() => startEdit(c)}>ویرایش</Button></TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}
        </Stack>
    );
}

type HGroup = { Name: string; ErpCode: string };

function ProductsTab() {
    const [code, setCode] = useState("");
    const [rows, setRows] = useState<HolooProduct[]>([]);
    const [loading, setLoading] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [sideGroups, setSideGroups] = useState<HGroup[]>([]);
    const [units, setUnits] = useState<HGroup[]>([]);
    const [form, setForm] = useState({ name: "", code: "", sidegrouperpcode: "", uniterpcode: "", few: "", buyprice: "", sellprice: "" });
    const [saving, setSaving] = useState(false);
    const [editErp, setEditErp] = useState<string>("");
    const [page, setPage] = useState(0); // 0-based for MUI TablePagination
    const [limit, setLimit] = useState(20);
    const [total, setTotal] = useState(0);

    const load = useCallback(async (opts?: { page?: number; limit?: number }) => {
        const p = opts?.page ?? page;
        const l = opts?.limit ?? limit;
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (code.trim()) params.set("code", code.trim());
            params.set("page", String(p + 1)); // server is 1-based
            params.set("limit", String(l));
            const res = await api<{ products: HolooProduct[]; total?: number }>(
                `/api/holoo/products?${params.toString()}`,
            );
            setRows(res.products || []);
            setTotal(res.total ?? (res.products?.length || 0));
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setLoading(false);
        }
    }, [code, page, limit]);

    // Reset to first page on a new search; reload when page/limit change.
    function search() {
        setPage(0);
        load({ page: 0 });
    }

    useEffect(() => { load(); }, [page, limit]);

    async function ensureGroups() {
        if (!sideGroups.length) {
            try {
                const res = await api<{ sideGroups: HGroup[]; units: HGroup[] }>("/api/holoo/groups");
                setSideGroups(res.sideGroups || []);
                setUnits(res.units || []);
            } catch (e: any) {
                toast.error(e.message);
            }
        }
    }

    function resetForm() {
        setForm({ name: "", code: "", sidegrouperpcode: "", uniterpcode: "", few: "", buyprice: "", sellprice: "" });
        setEditErp("");
    }

    function openForm() {
        if (showForm) { resetForm(); setShowForm(false); return; }
        setShowForm(true);
        ensureGroups();
    }

    function startEdit(p: HolooProduct) {
        ensureGroups();
        setForm({ name: p.Name || "", code: p.Code || "", sidegrouperpcode: "", uniterpcode: "", few: String(p.Few ?? ""), buyprice: "", sellprice: String(p.SellPrice ?? "") });
        setEditErp(p.ErpCode);
        setShowForm(true);
    }

    async function save() {
        if (!form.name.trim()) { toast.error("نام کالا الزامی است"); return; }
        if (!editErp && !form.sidegrouperpcode) { toast.error("گروه فرعی را انتخاب کنید"); return; }
        setSaving(true);
        try {
            const base: Record<string, unknown> = {
                name: form.name.trim(),
                code: form.code.trim() || undefined,
                uniterpcode: form.uniterpcode || undefined,
                few: form.few ? Number(form.few) : undefined,
                buyprice: form.buyprice ? Number(form.buyprice) : undefined,
                sellprice: form.sellprice ? Number(form.sellprice) : undefined,
            };
            const res = await api<{ success: boolean; ErpCode?: string }>("/api/holoo/products", {
                method: editErp ? "PUT" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(editErp ? { ...base, erpcode: editErp } : { ...base, sidegrouperpcode: form.sidegrouperpcode }),
            });
            toast.success(editErp ? "کالا ویرایش شد" : `کالا ثبت شد (ErpCode: ${res.ErpCode})`);
            resetForm();
            setShowForm(false);
            load();
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setSaving(false);
        }
    }

    return (
        <Stack spacing={2}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
                <Box flex={1}><SearchBar value={code} onChange={setCode} onSearch={search} loading={loading} placeholder="کد کالا (اختیاری)" /></Box>
                <Button variant={showForm ? "outlined" : "contained"} onClick={openForm}>
                    {showForm ? "بستن فرم" : "افزودن کالا"}
                </Button>
            </Stack>

            {showForm && (
                <Card variant="outlined">
                    <CardContent>
                        <Stack spacing={1.5}>
                            {editErp && <Typography variant="caption" color="primary.main">ویرایش کالا (ErpCode: {editErp})</Typography>}
                            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                                <TextField size="small" fullWidth label="نام کالا *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                                <TextField size="small" fullWidth label="کد (اختیاری)" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
                            </Stack>
                            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                                <TextField size="small" fullWidth select SelectProps={{ native: true }} label={editErp ? "گروه فرعی (بدون تغییر)" : "گروه فرعی *"} value={form.sidegrouperpcode} onChange={(e) => setForm({ ...form, sidegrouperpcode: e.target.value })} disabled={Boolean(editErp)}>
                                    <option value="">انتخاب گروه...</option>
                                    {sideGroups.map((g) => <option key={g.ErpCode} value={g.ErpCode}>{g.Name}</option>)}
                                </TextField>
                                <TextField size="small" fullWidth select SelectProps={{ native: true }} label="واحد" value={form.uniterpcode} onChange={(e) => setForm({ ...form, uniterpcode: e.target.value })}>
                                    <option value="">انتخاب واحد...</option>
                                    {units.map((u) => <option key={u.ErpCode} value={u.ErpCode}>{u.Name}</option>)}
                                </TextField>
                            </Stack>
                            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                                <TextField size="small" fullWidth label="موجودی اول دوره" type="number" value={form.few} onChange={(e) => setForm({ ...form, few: e.target.value })} />
                                <TextField size="small" fullWidth label="قیمت خرید (ریال)" type="number" value={form.buyprice} onChange={(e) => setForm({ ...form, buyprice: e.target.value })} />
                                <TextField size="small" fullWidth label="قیمت فروش (ریال)" type="number" value={form.sellprice} onChange={(e) => setForm({ ...form, sellprice: e.target.value })} />
                            </Stack>
                            <Stack direction="row" justifyContent="flex-end">
                                <Button variant="contained" onClick={save} disabled={saving} startIcon={saving ? <CircularProgress size={16} color="inherit" /> : undefined}>
                                    {editErp ? "ذخیره ویرایش" : "ثبت در هلو"}
                                </Button>
                            </Stack>
                        </Stack>
                    </CardContent>
                </Card>
            )}

            <Divider />
            {total > 0 && (
                <Typography variant="caption" color="text.secondary">
                    {total.toLocaleString("fa-IR")} کالا
                </Typography>
            )}
            {loading ? (
                <Box textAlign="center" py={4}><CircularProgress size={28} /></Box>
            ) : !rows.length ? (
                <Typography color="text.secondary" textAlign="center" py={4}>موردی برای نمایش نیست.</Typography>
            ) : (
                <TableContainer>
                    <Table size="small">
                        <TableHead>
                            <TableRow sx={{ "& th": { fontWeight: 700 } }}>
                                <TableCell>کد</TableCell><TableCell>نام</TableCell><TableCell>موجودی</TableCell>
                                <TableCell>قیمت فروش</TableCell><TableCell>ErpCode</TableCell><TableCell align="center">ویرایش</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {rows.map((p) => (
                                <TableRow key={p.ErpCode} hover>
                                    <TableCell>{p.Code}</TableCell>
                                    <TableCell>{p.Name}</TableCell>
                                    <TableCell>{p.Few || "—"}</TableCell>
                                    <TableCell>{p.SellPrice || "—"}</TableCell>
                                    <TableCell sx={{ fontFamily: "monospace" }}>{p.ErpCode}</TableCell>
                                    <TableCell align="center"><Button size="small" onClick={() => startEdit(p)}>ویرایش</Button></TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                    <TablePagination
                        component="div"
                        count={total}
                        page={page}
                        onPageChange={(_, p) => setPage(p)}
                        rowsPerPage={limit}
                        onRowsPerPageChange={(e) => { setLimit(Number(e.target.value)); setPage(0); }}
                        rowsPerPageOptions={[20, 50, 100]}
                        labelRowsPerPage="تعداد در صفحه:"
                        labelDisplayedRows={({ from, to, count }) =>
                            `${from.toLocaleString("fa-IR")}–${to.toLocaleString("fa-IR")} از ${count.toLocaleString("fa-IR")}`
                        }
                    />
                </TableContainer>
            )}
        </Stack>
    );
}

function ProductMappingTab() {
    const [mappings, setMappings] = useState<{ sku: string; erpcode: string }[]>([]);
    const [loading, setLoading] = useState(false);
    const [autoBusy, setAutoBusy] = useState(false);
    const [batchBusy, setBatchBusy] = useState(false);
    const [batchProgress, setBatchProgress] = useState<{ done: number; total: number } | null>(null);
    const [sku, setSku] = useState("");
    const [holooCode, setHolooCode] = useState("");
    const [found, setFound] = useState<HolooProduct[]>([]);
    const [searching, setSearching] = useState(false);
    const [sideGroups, setSideGroups] = useState<HGroup[]>([]);
    const [prefixes, setPrefixes] = useState<{ prefix: string; sample: string; count: number }[]>([]);
    const [prefixMap, setPrefixMap] = useState<Record<string, string>>({});
    const [verifyBusy, setVerifyBusy] = useState(false);
    const [verifyResult, setVerifyResult] = useState<{
        invalidCount: number;
        note: string;
        results: { prefix: string; valid: boolean; sideGroupName: string | null }[];
    } | null>(null);

    async function verifyPrefixMap() {
        setVerifyBusy(true);
        try {
            const res = await api<{
                invalidCount: number;
                note: string;
                results: { prefix: string; valid: boolean; sideGroupName: string | null }[];
            }>("/api/holoo/prefix-map/verify");
            setVerifyResult(res);
            if (res.invalidCount === 0) toast.success(res.note);
            else toast.warning(res.note);
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setVerifyBusy(false);
        }
    }

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api<{ mappings: { sku: string; erpcode: string }[] }>("/api/holoo/product-mappings");
            setMappings(res.mappings || []);
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);
    useEffect(() => {
        (async () => {
            try {
                const pm = await api<{
                    sideGroups: HGroup[];
                    prefixes: { prefix: string; sample: string; count: number }[];
                    map: Record<string, string>;
                }>("/api/holoo/prefix-map");
                setSideGroups(pm.sideGroups || []);
                setPrefixes(pm.prefixes || []);
                setPrefixMap(pm.map || {});
            } catch { /* ignore */ }
        })();
    }, []);

    async function savePrefix(prefix: string, erp: string) {
        setPrefixMap((m) => {
            const next = { ...m };
            if (erp) next[prefix] = erp; else delete next[prefix];
            return next;
        });
        try {
            await api("/api/holoo/prefix-map", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prefix, erpcode: erp }) });
        } catch (e: any) {
            toast.error(e.message);
        }
    }

    async function batchSend() {
        if (!window.confirm(
            "کالاهای فعالِ دارای بارکد را دسته‌ای در هلو می‌سازد/به‌روزرسانی می‌کند " +
            "(قیمت و موجودی). پیشوندهای وصل‌نشده رد می‌شوند. ادامه می‌دهید؟",
        )) return;
        setBatchBusy(true);
        setBatchProgress(null);
        try {
            // 1) Build the work list from reconcile (DB-only, fast — no Holoo
            //    calls). Skip products already in sync; only create missing and
            //    update mismatched.
            const rec = await api<{
                rows: { ref: string; barcode: string; name: string; status: string; erpcode: string | null; sitePrice: number; siteFew: number }[];
            }>("/api/holoo/products/reconcile?status=active&limit=2000");
            const targets = (rec.rows || []).filter((r) => r.status !== "ok");
            if (!targets.length) {
                toast.info("همه‌ی کالاها از قبل با هلو هماهنگ‌اند.");
                return;
            }
            const items = targets.map((r) => ({
                ref: r.ref, barcode: r.barcode, name: r.name,
                sellprice: r.sitePrice, few: r.siteFew,
                erpcode: r.erpcode ?? undefined,
            }));

            // 2) Send in small chunks so no single request can hit a 504.
            const CHUNK = 5;
            let done = 0, succeeded = 0, failed = 0;
            setBatchProgress({ done: 0, total: items.length });
            for (let i = 0; i < items.length; i += CHUNK) {
                const chunk = items.slice(i, i + CHUNK);
                try {
                    const res = await api<{ succeeded: number; failed: number }>(
                        "/api/holoo/products/batch",
                        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items: chunk }) },
                    );
                    succeeded += res.succeeded || 0;
                    failed += res.failed || 0;
                } catch {
                    failed += chunk.length;
                }
                done += chunk.length;
                setBatchProgress({ done, total: items.length });
            }
            toast.success(`${succeeded.toLocaleString("fa-IR")} موفق، ${failed.toLocaleString("fa-IR")} خطا (از ${items.length.toLocaleString("fa-IR")} کالای نیازمند ارسال)`);
            load();
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setBatchBusy(false);
            setBatchProgress(null);
        }
    }

    async function autoMap() {
        setAutoBusy(true);
        try {
            const res = await api<{ checked: number; matched: number; remaining: number; note?: string }>(
                "/api/holoo/product-mappings",
                { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ auto: true }) },
            );
            const summary = `${res.matched.toLocaleString("fa-IR")} از ${res.checked.toLocaleString("fa-IR")} کالا نگاشت شد. باقی‌مانده: ${res.remaining.toLocaleString("fa-IR")}`;
            if (res.matched === 0 && res.note) toast.warning(`${summary} — ${res.note}`);
            else toast.success(summary);
            load();
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setAutoBusy(false);
        }
    }

    async function searchHoloo() {
        if (!holooCode.trim()) return;
        setSearching(true);
        try {
            const res = await api<{ products: HolooProduct[] }>(`/api/holoo/products?code=${encodeURIComponent(holooCode.trim())}`);
            setFound(res.products || []);
            if (!res.products?.length) toast.info("کالایی با این کد در هلو یافت نشد.");
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setSearching(false);
        }
    }

    async function assign(erpcode: string) {
        if (!sku.trim()) { toast.error("ابتدا SKU سایت را وارد کنید"); return; }
        try {
            await api("/api/holoo/product-mappings", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sku: sku.trim(), erpcode }),
            });
            toast.success(`نگاشت ذخیره شد: ${sku.trim()} → ${erpcode}`);
            setSku(""); setHolooCode(""); setFound([]);
            load();
        } catch (e: any) {
            toast.error(e.message);
        }
    }

    async function remove(s: string) {
        try {
            await api(`/api/holoo/product-mappings?sku=${encodeURIComponent(s)}`, { method: "DELETE" });
            load();
        } catch (e: any) {
            toast.error(e.message);
        }
    }

    return (
        <Stack spacing={2}>
            <Alert severity="info" variant="outlined">
                برای ثبتِ خودکارِ فاکتورها در هلو، هر کالای فروشگاه باید به یک کالای هلو نگاشت شود. کدِ کالا در هلو همان <b>بارکدِ</b> کالاست. «نگاشت خودکار» بارکدِ کالا را با کدِ کالای هلو تطبیق می‌دهد؛ موارد بدونِ تطبیق را دستی نگاشت کنید.
            </Alert>

            <Card variant="outlined">
                <CardContent>
                    <Typography fontWeight={700} mb={0.5}>گروه‌بندیِ حسابداری — اتصالِ پریفیکس به گروهِ فرعی</Typography>
                    <Typography variant="body2" color="text.secondary" mb={1.5}>
                        کدِ حسابداریِ هر کالا همان <b>بارکدِ</b> آن است (مثلِ <code>۰۰۱-۲۸۴۲۱۱۵</code>). بخشِ پیش از خط‌تیره، <b>پریفیکسِ</b> حسابداری است. گروه‌های فرعی را خودتان در پنلِ هلو بسازید، سپس هر پریفیکس را به یک گروهِ فرعی وصل کنید. هنگامِ ثبتِ فاکتور، کالا با کد = بارکد و زیرِ همان گروهِ فرعی ثبت می‌شود. <b>پریفیکسِ وصل‌نشده → کالا سینک نمی‌شود</b> (کدِ ساختگی ساخته نمی‌شود).
                    </Typography>

                    {prefixes.length > 0 ? (
                        <TableContainer sx={{ maxHeight: 360 }}>
                            <Table size="small" stickyHeader>
                                <TableHead>
                                    <TableRow sx={{ "& th": { fontWeight: 700 } }}>
                                        <TableCell>پریفیکس</TableCell>
                                        <TableCell>نمونه بارکد</TableCell>
                                        <TableCell align="center">تعداد کالا</TableCell>
                                        <TableCell>گروه فرعیِ هلو</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {prefixes.map((p) => (
                                        <TableRow key={p.prefix} hover>
                                            <TableCell sx={{ fontFamily: "monospace", fontWeight: 700 }}>{p.prefix}</TableCell>
                                            <TableCell sx={{ fontFamily: "monospace" }}>{p.sample}</TableCell>
                                            <TableCell align="center">{p.count.toLocaleString("fa-IR")}</TableCell>
                                            <TableCell>
                                                <TextField size="small" select SelectProps={{ native: true }} value={prefixMap[p.prefix] || ""}
                                                    onChange={(e) => savePrefix(p.prefix, e.target.value)} sx={{ minWidth: 260 }}>
                                                    <option value="">— وصل‌نشده —</option>
                                                    {sideGroups.map((g) => <option key={g.ErpCode} value={g.ErpCode}>{g.Name}</option>)}
                                                </TextField>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    ) : (
                        <Typography variant="caption" color="text.secondary">هیچ بارکدِ دارای پریفیکس (الگوی «۰۰۱-…») در کالاهای سایت یافت نشد.</Typography>
                    )}

                    <Stack direction="row" spacing={1} alignItems="center" mt={2}>
                        <Button size="small" variant="outlined" onClick={verifyPrefixMap} disabled={verifyBusy}
                            startIcon={verifyBusy ? <CircularProgress size={14} color="inherit" /> : undefined}>
                            بررسی اعتبار نگاشت‌ها در هلو
                        </Button>
                        <Typography variant="caption" color="text.secondary">
                            بررسی می‌کند آیا گروه فرعیِ هر پریفیکس هنوز در هلو موجود است (در صورت بازساخت گروه‌ها، نگاشت نامعتبر می‌شود).
                        </Typography>
                    </Stack>

                    {verifyResult && (
                        <Box mt={1.5}>
                            <Typography variant="body2" color={verifyResult.invalidCount ? "warning.main" : "success.main"} mb={verifyResult.invalidCount ? 1 : 0}>
                                {verifyResult.note}
                            </Typography>
                            {verifyResult.invalidCount > 0 && (
                                <Stack direction="row" gap={0.5} flexWrap="wrap">
                                    {verifyResult.results.filter((r) => !r.valid).map((r) => (
                                        <Chip key={r.prefix} size="small" color="warning" variant="outlined"
                                            label={`${r.prefix} — نامعتبر`} sx={{ fontFamily: "monospace" }} />
                                    ))}
                                </Stack>
                            )}
                        </Box>
                    )}
                </CardContent>
            </Card>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ sm: "center" }} flexWrap="wrap">
                <Button variant="contained" color="secondary" onClick={batchSend} disabled={batchBusy}
                    startIcon={batchBusy ? <CircularProgress size={16} color="inherit" /> : <SyncRounded />}>
                    ارسال گروهی کالا به هلو
                </Button>
                <Button variant="outlined" onClick={autoMap} disabled={autoBusy} startIcon={autoBusy ? <CircularProgress size={16} color="inherit" /> : <SyncRounded />}>
                    نگاشت خودکار (۶۰ تای بعدی)
                </Button>
                <Typography variant="caption" color="text.secondary">{mappings.length.toLocaleString("fa-IR")} نگاشت ذخیره شده</Typography>
            </Stack>
            <Typography variant="caption" color="text.secondary">
                ابتدا «ارسال گروهی کالا» کالاها را در هلو می‌سازد؛ سپس «نگاشت خودکار» SKUها را به کالای هلو وصل می‌کند.
                ارسال به‌صورت تکه‌تکه انجام می‌شود تا خطای ۵۰۴ ندهد.
            </Typography>

            {batchProgress && (
                <Box>
                    <Stack direction="row" justifyContent="space-between" mb={0.5}>
                        <Typography variant="caption">در حال ارسال به هلو…</Typography>
                        <Typography variant="caption">
                            {batchProgress.done.toLocaleString("fa-IR")} / {batchProgress.total.toLocaleString("fa-IR")}
                        </Typography>
                    </Stack>
                    <LinearProgress
                        variant="determinate"
                        value={batchProgress.total ? Math.round((batchProgress.done / batchProgress.total) * 100) : 0}
                    />
                </Box>
            )}

            <Card variant="outlined">
                <CardContent>
                    <Typography fontWeight={700} mb={1}>نگاشت دستی</Typography>
                    <Stack spacing={1.5}>
                        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                            <TextField size="small" fullWidth label="SKU سایت" value={sku} onChange={(e) => setSku(e.target.value)} />
                            <TextField size="small" fullWidth label="کد کالا در هلو" value={holooCode} onChange={(e) => setHolooCode(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && searchHoloo()} />
                            <Button variant="outlined" onClick={searchHoloo} disabled={searching || !holooCode.trim()}>
                                {searching ? <CircularProgress size={18} /> : "جستجو در هلو"}
                            </Button>
                        </Stack>
                        {found.length > 0 && (
                            <Stack spacing={0.5}>
                                {found.map((p) => (
                                    <Stack key={p.ErpCode} direction="row" justifyContent="space-between" alignItems="center" sx={{ p: 1, border: 1, borderColor: "divider", borderRadius: 1 }}>
                                        <Typography variant="body2">{p.Name} <Typography component="span" variant="caption" color="text.secondary">({p.Code})</Typography></Typography>
                                        <Button size="small" variant="contained" onClick={() => assign(p.ErpCode)}>نگاشت به این</Button>
                                    </Stack>
                                ))}
                            </Stack>
                        )}
                    </Stack>
                </CardContent>
            </Card>

            <Divider />
            {loading ? (
                <Box textAlign="center" py={3}><CircularProgress size={26} /></Box>
            ) : !mappings.length ? (
                <Typography color="text.secondary" textAlign="center" py={3}>هنوز نگاشتی ثبت نشده است.</Typography>
            ) : (
                <TableContainer>
                    <Table size="small">
                        <TableHead>
                            <TableRow sx={{ "& th": { fontWeight: 700 } }}>
                                <TableCell>SKU سایت</TableCell>
                                <TableCell>ErpCode هلو</TableCell>
                                <TableCell align="center">حذف</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {mappings.map((m) => (
                                <TableRow key={m.sku} hover>
                                    <TableCell sx={{ fontFamily: "monospace" }}>{m.sku}</TableCell>
                                    <TableCell sx={{ fontFamily: "monospace" }}>{m.erpcode}</TableCell>
                                    <TableCell align="center">
                                        <Button size="small" color="error" onClick={() => remove(m.sku)}>حذف</Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}
        </Stack>
    );
}

function SalesDocsTab() {
    const [kind, setKind] = useState<"preinvoice" | "order" | "invoice">("invoice");
    const [customer, setCustomer] = useState("");
    const [lines, setLines] = useState([{ ProductErpCode: "", few: "1", price: "" }]);
    const [inv, setInv] = useState({ type: "1", Cash: "", CashSarfasl: "", Bank: "", BankSarfasl: "", Nesiyeh: "", Discount: "" });
    const [saving, setSaving] = useState(false);
    const [result, setResult] = useState<string | null>(null);

    function setLine(i: number, patch: Partial<{ ProductErpCode: string; few: string; price: string }>) {
        setLines((p) => p.map((l, j) => (j === i ? { ...l, ...patch } : l)));
    }

    async function submit() {
        if (!customer.trim()) { toast.error("شناسه طرف‌حساب (ErpCode) را وارد کنید"); return; }
        const cleanLines = lines
            .filter((l) => l.ProductErpCode.trim() && Number(l.few) > 0)
            .map((l) => ({ ProductErpCode: l.ProductErpCode.trim(), few: Number(l.few), price: Number(l.price) || 0 }));
        if (!cleanLines.length) { toast.error("حداقل یک قلم با شناسه کالا و تعداد لازم است"); return; }
        setSaving(true);
        setResult(null);
        try {
            const payload: Record<string, unknown> = { kind, customererpcode: customer.trim(), lines: cleanLines };
            if (kind === "invoice") {
                Object.assign(payload, {
                    type: Number(inv.type),
                    Cash: inv.Cash ? Number(inv.Cash) : undefined,
                    CashSarfasl: inv.CashSarfasl || undefined,
                    Bank: inv.Bank ? Number(inv.Bank) : undefined,
                    BankSarfasl: inv.BankSarfasl || undefined,
                    Nesiyeh: inv.Nesiyeh ? Number(inv.Nesiyeh) : undefined,
                    Discount: inv.Discount ? Number(inv.Discount) : undefined,
                });
            }
            const res = await api<{ ReturnParam1?: string; ErpCode?: string }>("/api/holoo/documents", {
                method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
            });
            const num = res.ReturnParam1 || res.ErpCode || "";
            setResult(`سند ثبت شد — شماره: ${num}`);
            toast.success(`سند ثبت شد (شماره: ${num})`);
            setLines([{ ProductErpCode: "", few: "1", price: "" }]);
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setSaving(false);
        }
    }

    const labels = { preinvoice: "پیش‌فاکتور", order: "سفارش", invoice: "فاکتور" };

    return (
        <Stack spacing={2} sx={{ maxWidth: 900 }}>
            <Stack direction="row" spacing={1}>
                {(["invoice", "preinvoice", "order"] as const).map((k) => (
                    <Chip key={k} label={labels[k]} color={kind === k ? "primary" : "default"} variant={kind === k ? "filled" : "outlined"} onClick={() => setKind(k)} />
                ))}
            </Stack>

            <TextField size="small" label="شناسه طرف‌حساب در هلو (customererpcode)" value={customer} onChange={(e) => setCustomer(e.target.value)}
                helperText="ErpCode طرف‌حساب — از تب «طرف‌حساب‌ها» قابل دریافت است" />

            {kind === "invoice" && (
                <Card variant="outlined"><CardContent>
                    <Stack spacing={1.5}>
                        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                            <TextField size="small" fullWidth select SelectProps={{ native: true }} label="نوع فاکتور" value={inv.type} onChange={(e) => setInv({ ...inv, type: e.target.value })}>
                                <option value="1">فروش</option>
                                <option value="2">برگشت از فروش</option>
                                <option value="3">خرید</option>
                                <option value="4">برگشت از خرید</option>
                            </TextField>
                            <TextField size="small" fullWidth label="مبلغ نسیه (ریال)" type="number" value={inv.Nesiyeh} onChange={(e) => setInv({ ...inv, Nesiyeh: e.target.value })} />
                            <TextField size="small" fullWidth label="تخفیف (ریال)" type="number" value={inv.Discount} onChange={(e) => setInv({ ...inv, Discount: e.target.value })} />
                        </Stack>
                        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                            <TextField size="small" fullWidth label="مبلغ نقد" type="number" value={inv.Cash} onChange={(e) => setInv({ ...inv, Cash: e.target.value })} />
                            <TextField size="small" fullWidth label="سرفصل صندوق" value={inv.CashSarfasl} onChange={(e) => setInv({ ...inv, CashSarfasl: e.target.value })} />
                            <TextField size="small" fullWidth label="مبلغ کارت‌خوان" type="number" value={inv.Bank} onChange={(e) => setInv({ ...inv, Bank: e.target.value })} />
                            <TextField size="small" fullWidth label="سرفصل بانک" value={inv.BankSarfasl} onChange={(e) => setInv({ ...inv, BankSarfasl: e.target.value })} />
                        </Stack>
                        <Typography variant="caption" color="text.secondary">طبق هلو، جمعِ نقد+کارت‌خوان+نسیه باید با جمعِ فاکتور پس از تخفیف برابر باشد.</Typography>
                    </Stack>
                </CardContent></Card>
            )}

            <Typography fontWeight={700}>اقلام سند</Typography>
            {lines.map((l, i) => (
                <Stack key={i} direction={{ xs: "column", sm: "row" }} spacing={1} alignItems="center">
                    <TextField size="small" fullWidth label="شناسه کالا (ProductErpCode)" value={l.ProductErpCode} onChange={(e) => setLine(i, { ProductErpCode: e.target.value })} />
                    <TextField size="small" label="تعداد" type="number" value={l.few} onChange={(e) => setLine(i, { few: e.target.value })} sx={{ width: { sm: 110 } }} />
                    <TextField size="small" label="قیمت (ریال)" type="number" value={l.price} onChange={(e) => setLine(i, { price: e.target.value })} sx={{ width: { sm: 160 } }} />
                    {lines.length > 1 && <Button size="small" color="error" onClick={() => setLines((p) => p.filter((_, j) => j !== i))}>حذف</Button>}
                </Stack>
            ))}
            <Box>
                <Button size="small" onClick={() => setLines((p) => [...p, { ProductErpCode: "", few: "1", price: "" }])}>+ افزودن قلم</Button>
            </Box>

            {result && <Alert severity="success">{result}</Alert>}

            <Stack direction="row" justifyContent="flex-end">
                <Button variant="contained" onClick={submit} disabled={saving} startIcon={saving ? <CircularProgress size={16} color="inherit" /> : undefined}>
                    ثبت {labels[kind]} در هلو
                </Button>
            </Stack>
        </Stack>
    );
}

function PaymentsTab() {
    const [kind, setKind] = useState<"receive" | "havaleh">("receive");
    const [form, setForm] = useState({ customersarfasl: "", cash: "", cashsarfasl: "", bank: "", banksarfasl: "", discount: "", comment: "" });
    const [saving, setSaving] = useState(false);

    async function save() {
        if (!form.customersarfasl.trim()) { toast.error("سرفصل طرف‌حساب الزامی است"); return; }
        setSaving(true);
        try {
            const res = await api<{ success: boolean; ErpCode?: string; ReturnParam1?: string }>("/api/holoo/payments", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    kind,
                    customersarfasl: form.customersarfasl.trim(),
                    cash: form.cash ? Number(form.cash) : undefined,
                    cashsarfasl: form.cashsarfasl.trim() || undefined,
                    bank: form.bank ? Number(form.bank) : undefined,
                    banksarfasl: form.banksarfasl.trim() || undefined,
                    discount: form.discount ? Number(form.discount) : undefined,
                    comment: form.comment.trim() || undefined,
                }),
            });
            toast.success(`سند ثبت شد (شماره: ${res.ReturnParam1 || res.ErpCode})`);
            setForm({ customersarfasl: "", cash: "", cashsarfasl: "", bank: "", banksarfasl: "", discount: "", comment: "" });
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setSaving(false);
        }
    }

    return (
        <Stack spacing={2} sx={{ maxWidth: 720 }}>
            <Stack direction="row" spacing={1}>
                <Chip label="دریافت از طرف‌حساب" color={kind === "receive" ? "primary" : "default"} variant={kind === "receive" ? "filled" : "outlined"} onClick={() => setKind("receive")} />
                <Chip label="حواله طرف‌حساب" color={kind === "havaleh" ? "primary" : "default"} variant={kind === "havaleh" ? "filled" : "outlined"} onClick={() => setKind("havaleh")} />
            </Stack>
            <Typography variant="body2" color="text.secondary">
                {kind === "receive"
                    ? "ثبت سند دریافت وجه از طرف‌حساب (نقد و/یا بانک)."
                    : "ثبت سند حواله/پرداخت به طرف‌حساب از طریق بانک."}
            </Typography>
            <Card variant="outlined">
                <CardContent>
                    <Stack spacing={1.5}>
                        <TextField size="small" fullWidth label="سرفصل طرف‌حساب (customersarfasl) *" value={form.customersarfasl} onChange={(e) => setForm({ ...form, customersarfasl: e.target.value })} helperText="کد سرفصل طرف‌حساب در درخت حسابداری هلو" />
                        {kind === "receive" && (
                            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                                <TextField size="small" fullWidth label="مبلغ نقد (ریال)" type="number" value={form.cash} onChange={(e) => setForm({ ...form, cash: e.target.value })} />
                                <TextField size="small" fullWidth label="سرفصل صندوق" value={form.cashsarfasl} onChange={(e) => setForm({ ...form, cashsarfasl: e.target.value })} />
                            </Stack>
                        )}
                        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                            <TextField size="small" fullWidth label={`مبلغ بانک (ریال)${kind === "havaleh" ? " *" : ""}`} type="number" value={form.bank} onChange={(e) => setForm({ ...form, bank: e.target.value })} />
                            <TextField size="small" fullWidth label={`سرفصل بانک${kind === "havaleh" ? " *" : ""}`} value={form.banksarfasl} onChange={(e) => setForm({ ...form, banksarfasl: e.target.value })} />
                        </Stack>
                        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                            <TextField size="small" fullWidth label="تخفیف (ریال)" type="number" value={form.discount} onChange={(e) => setForm({ ...form, discount: e.target.value })} />
                            <TextField size="small" fullWidth label="توضیحات" value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} />
                        </Stack>
                        <Stack direction="row" justifyContent="flex-end">
                            <Button variant="contained" onClick={save} disabled={saving} startIcon={saving ? <CircularProgress size={16} color="inherit" /> : undefined}>ثبت سند</Button>
                        </Stack>
                    </Stack>
                </CardContent>
            </Card>
        </Stack>
    );
}

function InvoicesTab() {
    const [rows, setRows] = useState<HolooInvoice[]>([]);
    const [loading, setLoading] = useState(false);
    const [note, setNote] = useState<string | null>(null);

    async function load() {
        setLoading(true);
        try {
            const res = await api<{ invoices: HolooInvoice[]; unavailable?: boolean; note?: string }>(`/api/holoo/invoices`);
            setRows(res.invoices || []);
            setNote(res.unavailable ? res.note ?? "این گزارش در دسترس نیست." : null);
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        load();
    }, []);

    return (
        <Stack spacing={2}>
            <Box>
                <Button variant="outlined" startIcon={<RefreshRounded />} onClick={load} disabled={loading}>
                    بارگذاری فاکتورها
                </Button>
            </Box>
            {note && <Alert severity="info" variant="outlined">{note}</Alert>}
            <Divider />
            {!note && (
                <SimpleTable
                    loading={loading}
                    head={["شماره", "نوع", "طرف‌حساب", "تاریخ", "مبلغ", "ErpCode"]}
                    rows={rows.map((i) => [i.Code, i.Type, i.CustomerName, i.Date, i.SumPrice, i.ErpCode])}
                />
            )}
        </Stack>
    );
}

function SearchBar({
    value,
    onChange,
    onSearch,
    loading,
    placeholder,
}: {
    value: string;
    onChange: (v: string) => void;
    onSearch: () => void;
    loading: boolean;
    placeholder: string;
}) {
    return (
        <Stack direction="row" spacing={1.5}>
            <TextField
                size="small"
                fullWidth
                placeholder={placeholder}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && onSearch()}
            />
            <Button variant="contained" onClick={onSearch} disabled={loading}>
                {loading ? <CircularProgress size={18} color="inherit" /> : "جستجو"}
            </Button>
        </Stack>
    );
}

function SimpleTable({
    head,
    rows,
    loading,
}: {
    head: string[];
    rows: (string | number)[][];
    loading: boolean;
}) {
    if (loading) {
        return (
            <Box textAlign="center" py={4}>
                <CircularProgress size={28} />
            </Box>
        );
    }
    if (!rows.length) {
        return (
            <Typography color="text.secondary" textAlign="center" py={4}>
                موردی برای نمایش نیست.
            </Typography>
        );
    }
    return (
        <TableContainer>
            <Table size="small">
                <TableHead>
                    <TableRow>
                        {head.map((h) => (
                            <TableCell key={h} sx={{ fontWeight: 700 }}>
                                {h}
                            </TableCell>
                        ))}
                    </TableRow>
                </TableHead>
                <TableBody>
                    {rows.map((r, i) => (
                        <TableRow key={i} hover>
                            {r.map((c, j) => (
                                <TableCell key={j} sx={{ fontFamily: j === r.length - 1 ? "monospace" : undefined }}>
                                    {c}
                                </TableCell>
                            ))}
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </TableContainer>
    );
}

// ─── Reconcile / Health check tab ────────────────────────────────────────────
// Compares the site catalog against Holoo (recovery after a partial 504 batch)
// and fixes gaps via CHUNKED batch calls: small requests, sequential, with a
// progress bar — so a long run never hits a gateway timeout and the user sees
// how far it got. (No background worker needed in serverless Next.js.)

type ReconcileRow = {
    ref: string;
    barcode: string;
    name: string;
    status: "missing" | "mismatch" | "ok";
    erpcode: string | null;
    sitePrice: number;
    holooPrice: number | null;
    siteFew: number;
    holooFew: number | null;
    diffs: string[];
};

type ReconcileSummary = { total: number; missing: number; mismatch: number; ok: number; holooTotal: number };

// Small chunks keep each HTTP request short (≈1 Holoo call/item) so a long run
// never hits a gateway timeout (504). Reliability over throughput.
const CHUNK_SIZE = 5;

function ReconcileTab() {
    const [rows, setRows] = useState<ReconcileRow[]>([]);
    const [summary, setSummary] = useState<ReconcileSummary | null>(null);
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState<{ running: boolean; done: number; total: number; label: string } | null>(null);
    const [reasons, setReasons] = useState<{ counts: Record<string, number>; samples: Record<string, string> } | null>(null);
    const [statusFilter, setStatusFilter] = useState<"problem" | "missing" | "mismatch" | "ok" | "all">("problem");

    const runReconcile = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api<{ summary: ReconcileSummary; rows: ReconcileRow[] }>(
                "/api/holoo/products/reconcile?status=active&limit=2000",
            );
            setRows(res.rows || []);
            setSummary(res.summary || null);
            toast.success(
                `${res.summary.total.toLocaleString("fa-IR")} کالا بررسی شد — ناموجود: ${res.summary.missing.toLocaleString("fa-IR")}، ناهماهنگ: ${res.summary.mismatch.toLocaleString("fa-IR")}`,
            );
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { runReconcile(); }, [runReconcile]);

    /** Push the given rows to Holoo in small sequential chunks with progress. */
    async function runChunked(targets: ReconcileRow[], label: string) {
        if (!targets.length) { toast.info("موردی برای این عملیات نیست."); return; }
        const items = targets.map((r) => ({
            ref: r.ref, barcode: r.barcode, name: r.name,
            sellprice: r.sitePrice, // already ریال
            few: r.siteFew,
            // Known ErpCode (mismatch rows) → server updates in 1 call, no GET.
            erpcode: r.erpcode ?? undefined,
        }));
        let done = 0;
        let succeeded = 0;
        let failed = 0;
        const reasonCount: Record<string, number> = {};
        const sampleDetail: Record<string, string> = {};
        setProgress({ running: true, done: 0, total: items.length, label });
        setReasons(null);
        try {
            for (let i = 0; i < items.length; i += CHUNK_SIZE) {
                const chunk = items.slice(i, i + CHUNK_SIZE);
                try {
                    const res = await api<{
                        succeeded: number; failed: number;
                        results?: { ok: boolean; reason?: string; detail?: string }[];
                    }>(
                        "/api/holoo/products/batch",
                        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items: chunk }) },
                    );
                    succeeded += res.succeeded || 0;
                    failed += res.failed || 0;
                    for (const r of res.results || []) {
                        if (!r.ok) {
                            const key = r.reason || "error";
                            reasonCount[key] = (reasonCount[key] || 0) + 1;
                            if (r.detail && !sampleDetail[key]) sampleDetail[key] = r.detail;
                        }
                    }
                } catch (e: any) {
                    // Whole chunk failed (network / 504 / 500). Capture the message.
                    failed += chunk.length;
                    const key = e?.message?.includes("504") ? "gateway_timeout_504" : "request_failed";
                    reasonCount[key] = (reasonCount[key] || 0) + chunk.length;
                    if (e?.message && !sampleDetail[key]) sampleDetail[key] = String(e.message).slice(0, 160);
                }
                done += chunk.length;
                setProgress({ running: true, done, total: items.length, label });
            }
            setReasons(Object.keys(reasonCount).length ? { counts: reasonCount, samples: sampleDetail } : null);
            if (failed > 0) {
                const top = Object.entries(reasonCount).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}: ${v.toLocaleString("fa-IR")}`).join("، ");
                toast.warning(`${label}: ${succeeded.toLocaleString("fa-IR")} موفق، ${failed.toLocaleString("fa-IR")} خطا — ${top}`);
            } else {
                toast.success(`${label}: ${succeeded.toLocaleString("fa-IR")} موفق`);
            }
            runReconcile();
        } finally {
            setProgress(null);
        }
    }

    const missing = rows.filter((r) => r.status === "missing");
    const mismatch = rows.filter((r) => r.status === "mismatch");
    const filtered =
        statusFilter === "all" ? rows
        : statusFilter === "problem" ? rows.filter((r) => r.status !== "ok")
        : rows.filter((r) => r.status === statusFilter);
    const CAP = 1000;
    const shown = filtered.slice(0, CAP);
    const pct = progress && progress.total ? Math.round((progress.done / progress.total) * 100) : 0;

    return (
        <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
                مقایسه‌ی کالاهای سایت با هلو برای بازیابی بعد از خطای ۵۰۴. عملیات اصلاح به‌صورت تکه‌تکه و با نوار پیشرفت اجرا می‌شود تا دوباره تایم‌اوت نشود.
            </Typography>

            <Stack direction="row" spacing={1.5} flexWrap="wrap" alignItems="center">
                <Button variant="outlined" onClick={runReconcile} disabled={loading || Boolean(progress)}
                    startIcon={loading ? <CircularProgress size={14} color="inherit" /> : <SyncRounded />}>
                    بررسی مجدد
                </Button>
                <Button variant="contained" color="secondary" disabled={!missing.length || Boolean(progress)}
                    onClick={() => runChunked(missing, "ارسال کالاهای ناموجود")}>
                    ارسال کالاهای ناموجود ({missing.length.toLocaleString("fa-IR")})
                </Button>
                <Button variant="contained" disabled={!mismatch.length || Boolean(progress)}
                    onClick={() => runChunked(mismatch, "به‌روزرسانی ناهماهنگ‌ها")}>
                    به‌روزرسانی ناهماهنگ‌ها ({mismatch.length.toLocaleString("fa-IR")})
                </Button>
                <Button variant="text" disabled={!rows.length || Boolean(progress)}
                    onClick={() => runChunked(rows.filter((r) => r.status !== "missing"), "سینک موجودی همه")}>
                    سینک موجودی همه (سایت→هلو)
                </Button>
            </Stack>

            {progress && (
                <Box>
                    <Stack direction="row" justifyContent="space-between" mb={0.5}>
                        <Typography variant="caption">{progress.label}</Typography>
                        <Typography variant="caption">
                            {progress.done.toLocaleString("fa-IR")} / {progress.total.toLocaleString("fa-IR")} ({pct.toLocaleString("fa-IR")}٪)
                        </Typography>
                    </Stack>
                    <LinearProgress variant="determinate" value={pct} />
                </Box>
            )}

            {summary && (
                <Stack direction="row" spacing={1} flexWrap="wrap">
                    <Chip size="small" label={`واریانت سایت: ${summary.total.toLocaleString("fa-IR")}`} />
                    <Chip size="small" color="error" variant="outlined" label={`ناموجود: ${summary.missing.toLocaleString("fa-IR")}`} />
                    <Chip size="small" color="warning" variant="outlined" label={`ناهماهنگ: ${summary.mismatch.toLocaleString("fa-IR")}`} />
                    <Chip size="small" color="success" variant="outlined" label={`سالم: ${summary.ok.toLocaleString("fa-IR")}`} />
                    <Chip size="small" label={`در هلو: ${summary.holooTotal.toLocaleString("fa-IR")}`} />
                </Stack>
            )}

            {reasons && (
                <Box sx={{ p: 1.5, bgcolor: "warning.50", border: "1px solid", borderColor: "warning.200", borderRadius: 1 }}>
                    <Typography variant="caption" fontWeight={700} display="block" mb={0.5}>علت خطاها:</Typography>
                    <Stack spacing={0.25}>
                        {Object.entries(reasons.counts).map(([k, v]) => (
                            <Typography key={k} variant="caption" color="text.secondary">
                                {k}: {v.toLocaleString("fa-IR")}{reasons.samples[k] ? ` — ${reasons.samples[k]}` : ""}
                            </Typography>
                        ))}
                    </Stack>
                </Box>
            )}

            <Divider />

            {summary && (
                <Stack direction="row" spacing={1} flexWrap="wrap">
                    {(["problem", "missing", "mismatch", "ok", "all"] as const).map((f) => (
                        <Chip key={f} size="small"
                            color={statusFilter === f ? "primary" : "default"}
                            variant={statusFilter === f ? "filled" : "outlined"}
                            onClick={() => setStatusFilter(f)}
                            label={f === "problem" ? "مشکل‌دارها" : f === "missing" ? "ناموجود" : f === "mismatch" ? "ناهماهنگ" : f === "ok" ? "سالم" : "همه"} />
                    ))}
                </Stack>
            )}

            {loading ? (
                <Box textAlign="center" py={4}><CircularProgress size={28} /></Box>
            ) : !shown.length ? (
                <Typography color="text.secondary" textAlign="center" py={4}>
                    {summary ? "موردی در این فیلتر نیست." : "برای شروع، «بررسی مجدد» را بزنید."}
                </Typography>
            ) : (
                <TableContainer sx={{ maxHeight: 480 }}>
                    <Table size="small" stickyHeader>
                        <TableHead>
                            <TableRow sx={{ "& th": { fontWeight: 700 } }}>
                                <TableCell>وضعیت</TableCell>
                                <TableCell>بارکد</TableCell>
                                <TableCell>نام</TableCell>
                                <TableCell>تفاوت‌ها</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {shown.map((r) => (
                                <TableRow key={r.ref} hover>
                                    <TableCell>
                                        <Chip size="small"
                                            color={r.status === "missing" ? "error" : r.status === "mismatch" ? "warning" : "success"}
                                            variant="outlined"
                                            label={r.status === "missing" ? "ناموجود" : r.status === "mismatch" ? "ناهماهنگ" : "سالم"} />
                                    </TableCell>
                                    <TableCell sx={{ fontFamily: "monospace" }}>{r.barcode}</TableCell>
                                    <TableCell>{r.name}</TableCell>
                                    <TableCell>
                                        <Typography variant="caption" color="text.secondary">
                                            {r.diffs.join(" • ")}
                                        </Typography>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}
            {filtered.length > shown.length && (
                <Typography variant="caption" color="text.secondary">
                    {shown.length.toLocaleString("fa-IR")} از {filtered.length.toLocaleString("fa-IR")} ردیف نمایش داده شد.
                </Typography>
            )}
        </Stack>
    );
}
