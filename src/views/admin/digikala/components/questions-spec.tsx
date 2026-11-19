"use client";

import { RefreshButton } from "@/components/refresh";
import { PageJumper } from "@/components/search/pagination";
import {
    Box, Button, Chip, CircularProgress, Collapse, Container, Divider,
    IconButton, InputAdornment, LinearProgress, Pagination, Skeleton,
    Stack, TextField, Tooltip, Typography,
} from "@mui/material";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import QuestionAnswerRoundedIcon from "@mui/icons-material/QuestionAnswerRounded";
import SendRoundedIcon from "@mui/icons-material/SendRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import PendingRoundedIcon from "@mui/icons-material/PendingRounded";
import ErrorRoundedIcon from "@mui/icons-material/ErrorRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import ReplayRoundedIcon from "@mui/icons-material/ReplayRounded";
import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

// ─── DGK exact types (from API response) ──────────────────────────────────────

interface DgkAnswerStatus {
    title: string;
    key: "pending" | "confirmed" | "rejected" | string;
}

interface DgkAnswer {
    id: number;
    body: string;
    files?: unknown[];
    status: DgkAnswerStatus;
    date: string;
}

interface DgkProduct {
    id: number;
    title: string;
    link: string;
    photo: string;
}

interface QuestionItem {
    id: number;
    body: string;
    date: string;
    answer?: DgkAnswer | null;
    answer_count: number;
    product: DgkProduct;
    user: string;
}

interface QuestionsData {
    pager?: { page: number; item_per_page: number; total_pages: number; total_rows: number };
    items: QuestionItem[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string) {
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        return new Intl.DateTimeFormat("fa-IR", { year: "numeric", month: "short", day: "numeric" }).format(d);
    } catch {
        return dateStr;
    }
}

type AnswerKey = "pending" | "confirmed" | "rejected" | null;

function getAnswerState(q: QuestionItem): AnswerKey {
    if (!q.answer) return null;
    const k = q.answer.status?.key;
    if (k === "confirmed") return "confirmed";
    if (k === "rejected") return "rejected";
    return "pending";
}

const ANSWER_STATUS: Record<string, { label: string; color: "success" | "warning" | "error" | "default" }> = {
    confirmed: { label: "تایید شده", color: "success" },
    pending:   { label: "در حال بررسی", color: "warning" },
    rejected:  { label: "رد شده", color: "error" },
};

// ─── QuestionCard ─────────────────────────────────────────────────────────────

function QuestionCard({
    question,
    vendorId,
    template,
    onAnswered,
}: {
    question: QuestionItem;
    vendorId: string;
    template: string;
    onAnswered: (id: number) => void;
}) {
    const answerState = getAnswerState(question);
    const hasAnswer = answerState !== null;
    const needsAnswer = !hasAnswer || answerState === "rejected";

    const [expanded, setExpanded] = useState(false);
    const [answerText, setAnswerText] = useState(template);
    const [sending, setSending] = useState(false);

    useEffect(() => {
        if (needsAnswer && !answerText) setAnswerText(template);
    }, [template, needsAnswer]);

    function handleSend() {
        const text = answerText.trim();
        if (!text) { toast.error("متن پاسخ خالی است"); return; }
        setSending(true);
        fetch(`/api/digikala/open-api/questions/answer?vendorId=${encodeURIComponent(vendorId)}`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({ question_id: question.id, answer: text }),
        })
            .then(async (r) => {
                const json = await r.json().catch(() => null);
                if (!r.ok) throw new Error(json?.error || json?.data?.message || `خطای ${r.status}`);
                return json;
            })
            .then(() => {
                toast.success("پاسخ ارسال شد — در انتظار تایید دیجی‌کالا");
                onAnswered(question.id);
                setExpanded(false);
            })
            .catch((err) => {
                toast.error(`خطا در ارسال پاسخ: ${err.message}`);
            })
            .finally(() => setSending(false));
    }

    const borderColor = answerState === "confirmed" ? "success.light"
        : answerState === "rejected" ? "error.light"
        : answerState === "pending" ? "warning.light"
        : "grey.300";

    return (
        <Box sx={{ border: 1, borderColor, borderRadius: 2, overflow: "hidden" }}>
            {/* Main row */}
            <Stack direction="row" gap={1.5} alignItems="flex-start" sx={{ p: 1.5 }}>
                {/* Product image */}
                {question.product?.photo && (
                    <Tooltip title={question.product.title ?? ""}>
                        <Box
                            component="img"
                            src={question.product.photo}
                            loading="lazy"
                            width={44}
                            height={44}
                            alt={question.product.title ?? ""}
                            sx={{ borderRadius: 0.6, flexShrink: 0, cursor: "pointer" }}
                            onClick={() => question.product?.link && window.open(question.product.link, "_blank")}
                        />
                    </Tooltip>
                )}

                <Stack flex={1} spacing={0.5} minWidth={0}>
                    {/* Product title */}
                    {question.product?.title && (
                        <Stack direction="row" gap={0.5} alignItems="center">
                            <Typography variant="caption" color="primary.main" fontWeight={600}
                                component="a" href={question.product.link} target="_blank" rel="noopener"
                                sx={{ textDecoration: "none", "&:hover": { textDecoration: "underline" } }}>
                                {question.product.title}
                            </Typography>
                            <OpenInNewRoundedIcon sx={{ fontSize: 12, color: "primary.main" }} />
                        </Stack>
                    )}

                    {/* Question body */}
                    <Stack direction="row" gap={0.75} alignItems="flex-start">
                        <QuestionAnswerRoundedIcon
                            fontSize="small"
                            sx={{ color: hasAnswer ? "success.main" : "warning.main", mt: 0.2, flexShrink: 0 }}
                        />
                        <Typography variant="body2" color="text.primary" sx={{ lineHeight: 1.7, wordBreak: "break-word" }}>
                            {question.body}
                        </Typography>
                    </Stack>

                    {/* Meta: user, date, status */}
                    <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
                        {hasAnswer && answerState && (
                            <Chip
                                size="small"
                                icon={
                                    answerState === "confirmed" ? <CheckCircleRoundedIcon /> :
                                    answerState === "rejected"  ? <ErrorRoundedIcon /> :
                                    <PendingRoundedIcon />
                                }
                                label={ANSWER_STATUS[answerState]?.label ?? answerState}
                                color={ANSWER_STATUS[answerState]?.color ?? "default"}
                                variant={answerState === "confirmed" ? "filled" : "outlined"}
                            />
                        )}
                        {!hasAnswer && (
                            <Chip size="small" label="بی‌پاسخ" color="warning" variant="outlined" />
                        )}
                        {question.user && (
                            <Typography variant="caption" color="text.secondary">{question.user}</Typography>
                        )}
                        {question.date && (
                            <Typography variant="caption" color="text.disabled">{formatDate(question.date)}</Typography>
                        )}
                    </Stack>

                    {/* Existing answer body */}
                    {question.answer?.body && (
                        <Box sx={{
                            mt: 0.5, p: 1, borderRadius: 1, border: "1px solid",
                            borderColor: answerState === "confirmed" ? "success.light" : answerState === "rejected" ? "error.light" : "warning.light",
                            bgcolor: answerState === "confirmed" ? "rgba(var(--mui-palette-success-mainChannel) / 0.06)" : answerState === "rejected" ? "rgba(var(--mui-palette-error-mainChannel) / 0.06)" : "rgba(var(--mui-palette-warning-mainChannel) / 0.06)",
                        }}>
                            <Typography variant="caption" fontWeight={600} color={
                                answerState === "confirmed" ? "success.dark" : answerState === "rejected" ? "error.dark" : "warning.dark"
                            }>
                                پاسخ شما:
                            </Typography>
                            <Typography variant="caption" color="text.secondary" display="block" sx={{ lineHeight: 1.7, mt: 0.25 }}>
                                {question.answer.body}
                            </Typography>
                            {question.answer.date && (
                                <Typography variant="caption" color="text.disabled" display="block" sx={{ mt: 0.25 }}>
                                    {formatDate(question.answer.date)}
                                </Typography>
                            )}
                        </Box>
                    )}

                    {/* Rejected hint */}
                    {answerState === "rejected" && (
                        <Typography variant="caption" color="error.main" sx={{ display: "block", mt: 0.25 }}>
                            پاسخ رد شد — لطفاً پاسخ جدیدی ارسال کنید
                        </Typography>
                    )}
                </Stack>

                {/* Expand button for answer form */}
                {needsAnswer && (
                    <Tooltip title={expanded ? "بستن فرم پاسخ" : answerState === "rejected" ? "پاسخ مجدد" : "پاسخ دادن"}>
                        <IconButton size="small" onClick={() => setExpanded((v) => !v)} sx={{ mt: 0.25, flexShrink: 0 }}>
                            {answerState === "rejected"
                                ? <ReplayRoundedIcon fontSize="small" color="error" />
                                : <Box component={ExpandMoreRoundedIcon} fontSize="small"
                                    sx={{ transition: "transform .2s", transform: expanded ? "rotate(180deg)" : "none" }} />
                            }
                        </IconButton>
                    </Tooltip>
                )}
            </Stack>

            {/* Inline answer form */}
            {needsAnswer && (
                <Collapse in={expanded}>
                    <Divider />
                    <Stack direction="row" gap={1} alignItems="flex-end" sx={{ p: 1.5, bgcolor: "action.hover" }}>
                        <TextField
                            size="small"
                            multiline
                            minRows={2}
                            maxRows={6}
                            value={answerText}
                            onChange={(e) => setAnswerText(e.target.value)}
                            placeholder="متن پاسخ خود را بنویسید..."
                            fullWidth
                            disabled={sending}
                            slotProps={{ input: { dir: "rtl" } }}
                        />
                        <Button
                            variant="contained"
                            color={answerState === "rejected" ? "error" : "primary"}
                            onClick={handleSend}
                            disabled={sending || !answerText.trim()}
                            sx={{ minWidth: 0, px: 1.5, py: 1 }}
                            endIcon={sending ? <CircularProgress size={14} color="inherit" /> : <SendRoundedIcon />}
                        >
                            ارسال
                        </Button>
                    </Stack>
                </Collapse>
            )}
        </Box>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────

type FilterKey = "all" | "unanswered" | "pending" | "confirmed" | "rejected";

const FILTER_OPTIONS: { key: FilterKey; label: string; color: "default" | "warning" | "info" | "success" | "error" }[] = [
    { key: "all",        label: "همه",             color: "default" },
    { key: "unanswered", label: "بی‌پاسخ",          color: "warning" },
    { key: "pending",    label: "در حال بررسی",     color: "info" },
    { key: "confirmed",  label: "تایید شده",        color: "success" },
    { key: "rejected",   label: "رد شده",           color: "error" },
];

export default function QuestionsSpec({ vendorId }: { vendorId: string }) {
    const [loading, setLoading]   = useState(false);
    const [response, setResponse] = useState<QuestionsData | null>(null);
    const [error, setError]       = useState<string | null>(null);
    const [query, setQuery]       = useState("");
    const deferredQuery           = useDeferredValue(query);
    const [page, setPage]         = useState(1);
    const [filter, setFilter]     = useState<FilterKey>("unanswered");
    const [localAnswered, setLocalAnswered] = useState<Set<number>>(new Set());
    const [bulkBusy, setBulkBusy] = useState(false);
    const [bulkDone, setBulkDone] = useState(0);
    const abortRef = useRef<AbortController | null>(null);

    const [template, setTemplate] = useState("");
    useEffect(() => {
        fetch(`/api/digikala/open-api/preferences?vendorId=${encodeURIComponent(vendorId)}`, { credentials: "include" })
            .then((r) => r.ok ? r.json() : null)
            .then((payload) => {
                const prefs = payload?.data ?? {};
                if (prefs.questionAnswerTemplate) setTemplate(prefs.questionAnswerTemplate);
            })
            .catch(() => null);
    }, [vendorId]);

    function load() {
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;
        setLoading(true);
        setError(null);
        // DGK doesn't support server-side answered/unanswered filter — load all and filter client-side
        const params = new URLSearchParams({ vendorId, page: String(page), size: "50" });

        fetch(`/api/digikala/open-api/questions?${params.toString()}`, {
            credentials: "include",
            headers: { Accept: "application/json" },
            signal: controller.signal,
        })
            .then(async (r) => {
                const json = await r.json().catch(() => null);
                if (!r.ok) {
                    const msg = json?.error || json?.data?.message || `خطای ${r.status}`;
                    throw new Error(msg);
                }
                // proxy: {status, data: DGK_response} where DGK_response = {status, data: {items, pager}}
                const data = json?.data?.data ?? {};
                setResponse({ items: data?.items ?? [], pager: data?.pager });
                setLocalAnswered(new Set());
            })
            .catch((err) => {
                if (err instanceof DOMException && err.name === "AbortError") return;
                setError(err instanceof Error ? err.message : "خطا در بارگیری سوالات");
                toast.error("خطا در بارگیری سوالات دیجی‌کالا");
            })
            .finally(() => { if (abortRef.current === controller) setLoading(false); });
    }

    useEffect(load, [page, vendorId]);
    useEffect(() => () => { abortRef.current?.abort(); }, []);

    // Client-side filter + search
    const items = useMemo(() => {
        const all: QuestionItem[] = (response?.items ?? []).map((q) => ({
            ...q,
            // mark locally answered questions as pending
            answer: localAnswered.has(q.id) ? { id: 0, body: "", files: [], status: { title: "در حال بررسی", key: "pending" }, date: "" } : q.answer,
            answer_count: localAnswered.has(q.id) ? 1 : q.answer_count,
        }));

        const term = deferredQuery.trim().toLowerCase();

        return all.filter((q) => {
            // Text search
            if (term) {
                const haystack = [q.body, q.user, q.product?.title, String(q.id)].join(" ").toLowerCase();
                if (!haystack.includes(term)) return false;
            }
            // Status filter
            if (filter === "all") return true;
            const state = getAnswerState(q);
            if (filter === "unanswered") return state === null;
            if (filter === "pending") return state === "pending";
            if (filter === "confirmed") return state === "confirmed";
            if (filter === "rejected") return state === "rejected";
            return true;
        });
    }, [deferredQuery, response?.items, localAnswered, filter]);

    // Count badges for filter chips
    const counts = useMemo(() => {
        const all = response?.items ?? [];
        return {
            all: all.length,
            unanswered: all.filter((q) => getAnswerState(q) === null).length,
            pending:    all.filter((q) => getAnswerState(q) === "pending").length,
            confirmed:  all.filter((q) => getAnswerState(q) === "confirmed").length,
            rejected:   all.filter((q) => getAnswerState(q) === "rejected").length,
        };
    }, [response?.items]);

    const totalPages = Math.max(1, Number(response?.pager?.total_pages ?? 1));
    const totalRows  = Number(response?.pager?.total_rows ?? response?.items?.length ?? 0);
    const isInitialLoading = loading && !response;

    function handleFilterChange(f: FilterKey) {
        setFilter(f);
        setPage(1);
    }

    // Questions in the current view that still need an answer (unanswered or rejected).
    const answerable = useMemo(
        () => items.filter((q) => { const s = getAnswerState(q); return s === null || s === "rejected"; }),
        [items],
    );

    // Send the prepared template as the answer to every answerable question here.
    async function handleBulkAnswer() {
        const text = template.trim();
        if (!text) { toast.error("ابتدا متن آمادهٔ پاسخ را در تنظیمات دیجی‌کالا ثبت کنید"); return; }
        if (!answerable.length) return;
        if (!confirm(`ارسال پاسخ آماده به ${answerable.length} سوال بی‌پاسخ؟`)) return;
        setBulkBusy(true);
        setBulkDone(0);
        let ok = 0; let fail = 0;
        for (const q of answerable) {
            try {
                const r = await fetch(`/api/digikala/open-api/questions/answer?vendorId=${encodeURIComponent(vendorId)}`, {
                    method: "POST",
                    credentials: "include",
                    headers: { "Content-Type": "application/json", Accept: "application/json" },
                    body: JSON.stringify({ question_id: q.id, answer: text }),
                });
                if (!r.ok) throw new Error();
                setLocalAnswered((prev) => new Set([...prev, q.id]));
                ok += 1;
            } catch {
                fail += 1;
            }
            setBulkDone((d) => d + 1);
        }
        setBulkBusy(false);
        if (fail) toast.warning(`${ok.toLocaleString("fa-IR")} پاسخ ارسال شد، ${fail.toLocaleString("fa-IR")} ناموفق`);
        else toast.success(`${ok.toLocaleString("fa-IR")} پاسخ ارسال شد`);
    }

    return (
        <Container maxWidth={false} sx={{ my: 4, px: { xs: 1, md: 3 } }}>
            {loading && <LinearProgress />}

            {/* Header */}
            <Stack direction={{ xs: "column", md: "row" }} alignItems={{ xs: "stretch", md: "center" }} justifyContent="space-between" gap={1.5} sx={{ mb: 1.5 }}>
                <Stack>
                    <Typography variant="h6" fontWeight={800}>سوالات مشتریان دیجی‌کالا</Typography>
                    <Typography variant="caption" color="text.secondary">
                        {totalRows.toLocaleString("fa-IR")} سوال — صفحه {page.toLocaleString("fa-IR")} از {totalPages.toLocaleString("fa-IR")}
                        {counts.unanswered > 0 && (
                            <Box component="span" sx={{ mr: 1, color: "warning.main", fontWeight: 700 }}>
                                · {counts.unanswered.toLocaleString("fa-IR")} بی‌پاسخ در این صفحه
                            </Box>
                        )}
                        {counts.rejected > 0 && (
                            <Box component="span" sx={{ mr: 0.5, color: "error.main", fontWeight: 700 }}>
                                · {counts.rejected.toLocaleString("fa-IR")} رد شده
                            </Box>
                        )}
                    </Typography>
                </Stack>
                <Stack direction={{ xs: "column", sm: "row" }} gap={1} alignItems={{ xs: "stretch", sm: "center" }}>
                    <TextField
                        size="small"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="جستجو: متن سوال، نام کاربر، نام کالا..."
                        slotProps={{
                            input: {
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <SearchRoundedIcon fontSize="small" />
                                    </InputAdornment>
                                ),
                            },
                        }}
                        sx={{ minWidth: { xs: "100%", sm: 280 } }}
                    />
                    <RefreshButton disabled={loading} onClick={load} />
                </Stack>
            </Stack>

            {/* Filter chips */}
            <Stack direction="row" gap={0.75} flexWrap="wrap" sx={{ mb: 2 }}>
                {FILTER_OPTIONS.map((f) => (
                    <Chip
                        key={f.key}
                        label={`${f.label}${counts[f.key] > 0 ? ` (${counts[f.key]})` : ""}`}
                        color={filter === f.key ? f.color : "default"}
                        variant={filter === f.key ? "filled" : "outlined"}
                        onClick={() => handleFilterChange(f.key)}
                        clickable
                        size="small"
                    />
                ))}
            </Stack>

            {/* Bulk answer bar — answer all unanswered/rejected questions in view. */}
            {answerable.length > 0 && (
                <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ xs: "stretch", sm: "center" }} justifyContent="space-between" gap={1}
                    sx={{ mb: 2, p: 1.25, borderRadius: 2, bgcolor: "action.selected", border: 1, borderColor: "divider" }}>
                    <Typography variant="body2" fontWeight={700}>
                        {answerable.length.toLocaleString("fa-IR")} سوال بی‌پاسخ در این نما
                        {bulkBusy && ` — ${bulkDone.toLocaleString("fa-IR")} از ${answerable.length.toLocaleString("fa-IR")}`}
                    </Typography>
                    <Tooltip title={template.trim() ? "ارسال متن آمادهٔ پاسخ به همهٔ سوالات بی‌پاسخ این نما" : "ابتدا متن آماده را در تنظیمات ثبت کنید"}>
                        <span>
                            <Button size="small" variant="contained" disabled={bulkBusy || !template.trim()} onClick={handleBulkAnswer}
                                startIcon={bulkBusy ? <CircularProgress size={14} color="inherit" /> : <SendRoundedIcon />}>
                                پاسخ گروهی با متن آماده
                            </Button>
                        </span>
                    </Tooltip>
                </Stack>
            )}

            {/* Error */}
            {error && (
                <Stack direction={{ xs: "column", sm: "row" }} alignItems="center" justifyContent="space-between" gap={1}
                    sx={{ mb: 2, p: 2, border: 1, borderColor: "error.light", borderRadius: 2, bgcolor: "rgba(var(--mui-palette-error-mainChannel) / 0.08)" }}>
                    <Typography variant="body2" color="error.main">{error}</Typography>
                    <Button variant="outlined" color="error" disabled={loading} onClick={load}>تلاش دوباره</Button>
                </Stack>
            )}

            {/* List */}
            {isInitialLoading ? (
                <Stack spacing={1.5}>
                    {Array.from({ length: 6 }).map((_, i) => (
                        <Box key={i} sx={{ p: 1.5, border: 1, borderColor: "divider", borderRadius: 2 }}>
                            <Stack direction="row" gap={1.5}>
                                <Skeleton variant="rounded" width={44} height={44} />
                                <Stack flex={1} spacing={0.5}>
                                    <Skeleton variant="text" width="30%" />
                                    <Skeleton variant="text" width="75%" />
                                    <Skeleton variant="text" width="50%" />
                                </Stack>
                            </Stack>
                        </Box>
                    ))}
                </Stack>
            ) : (
                <Stack spacing={1.5}>
                    {items.map((q) => (
                        <QuestionCard
                            key={q.id}
                            question={q}
                            vendorId={vendorId}
                            template={template}
                            onAnswered={(id) => setLocalAnswered((prev) => new Set([...prev, id]))}
                        />
                    ))}
                    {!items.length && !loading && (
                        <Stack alignItems="center" spacing={1.5} sx={{ py: 8 }}>
                            <CheckCircleRoundedIcon sx={{ fontSize: 48, color: "success.light" }} />
                            <Typography variant="subtitle1" fontWeight={600}>
                                {filter === "unanswered" ? "همه سوالات پاسخ داده شده‌اند" : "سوالی در این دسته‌بندی یافت نشد"}
                            </Typography>
                            {filter !== "all" && (
                                <Button size="small" onClick={() => handleFilterChange("all")}>مشاهده همه</Button>
                            )}
                        </Stack>
                    )}
                </Stack>
            )}

            {/* Pagination */}
            <Stack direction={{ xs: "column", sm: "row" }} alignItems="center" justifyContent="space-between" gap={1.5} sx={{ mt: 3 }}>
                <Typography variant="caption" color="text.secondary">
                    هر صفحه ۵۰ سوال — متن آماده پاسخ را از تنظیمات دیجی‌کالا تغییر دهید
                </Typography>
                <Pagination
                    page={page}
                    count={totalPages}
                    siblingCount={1}
                    boundaryCount={1}
                    onChange={(_, n) => { setPage(n); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                />
                <PageJumper pages={totalPages} onJump={(p) => { setPage(p); window.scrollTo({ top: 0, behavior: "smooth" }); }} />
            </Stack>
        </Container>
    );
}
