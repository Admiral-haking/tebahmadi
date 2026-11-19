"use client";

import { useEffect, useMemo, useState } from "react";
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    CardHeader,
    Chip,
    Container,
    Divider,
    Rating,
    Stack,
    TextField,
    Typography,
} from "@mui/material";
import Link from "next/link";

type ReviewLine = {
    lineKey: string;
    productTitle: string;
    productSlug: string;
    variantSummary?: string;
    sku?: string;
    alreadyReviewed: boolean;
};

type VerificationState = {
    invoiceNumber: string;
    customerName?: string;
    lines: ReviewLine[];
};

type ReviewValue = { rating: number; comment: string };

interface ReviewPageProps {
    token: string;
}

const layoutStyles = {
    borderRadius: 2,
    border: "1px solid",
    borderColor: "divider",
    bgcolor: "background.paper",
};

const ERROR_MESSAGES: Record<string, string> = {
    expired: "اعتبار این لینک به پایان رسیده است.",
    already_submitted: "این لینک قبلا استفاده شده است.",
    not_found: "درخواست معتبر یافت نشد.",
    invoice_missing: "فاکتور مرتبط پیدا نشد.",
};

function getErrorMessage(value: unknown): string {
    if (typeof value === "string" && ERROR_MESSAGES[value]) {
        return ERROR_MESSAGES[value];
    }
    if (typeof value === "string") {
        return value;
    }
    return "خطا در پردازش درخواست.";
}

async function readJsonSafe(response: Response): Promise<any> {
    const text = await response.text();
    if (!text) return null;
    try {
        return JSON.parse(text);
    } catch {
        return null;
    }
}

export default function ReviewPage({ token }: ReviewPageProps) {
    const [submitting, setSubmitting] = useState(false);
    const [loading, setLoading] = useState(false);
    const [verification, setVerification] = useState<VerificationState | null>(null);
    const [values, setValues] = useState<Record<string, ReviewValue>>({});
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);

    const pendingLines = useMemo(
        () => verification?.lines.filter((line) => !line.alreadyReviewed) ?? [],
        [verification],
    );

    const hasEditableLines = pendingLines.length > 0;

    const handleLoad = async () => {
        setError(null);
        setNotice(null);
        setLoading(true);
        try {
            const response = await fetch("/api/reviews/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token }),
            });
            const json = await readJsonSafe(response);
            if (!response.ok) {
                const message = getErrorMessage(json?.error ?? "درخواست معتبر نیست.");
                setError(message);
                setVerification(null);
                return;
            }
            const data = json?.data as VerificationState | undefined;
            if (!data) {
                setError("پاسخ سرور معتبر نیست.");
                setVerification(null);
                return;
            }
            setVerification(data);
            const defaults: Record<string, ReviewValue> = {};
            data.lines.forEach((line) => {
                defaults[line.lineKey] = { rating: 5, comment: "" };
            });
            setValues(defaults);
            setNotice(`فاکتور ${data.invoiceNumber} بارگذاری شد.`);
        } catch (err) {
            const message = err instanceof Error ? err.message : "خطا در برقراری ارتباط با سرور";
            setError(getErrorMessage(message));
            setVerification(null);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async () => {
        if (!verification) return;
        setError(null);
        setNotice(null);
        const payloadReviews = verification.lines
            .filter((line) => !line.alreadyReviewed)
            .map((line) => {
                const value = values[line.lineKey] ?? { rating: 5, comment: "" };
                return {
                    lineKey: line.lineKey,
                    rating: value.rating ?? 5,
                    comment: value.comment?.trim(),
                };
            })
            .filter((entry) => entry.rating >= 1);

        if (payloadReviews.length === 0) {
            setError("مورد جدیدی برای ثبت نظر وجود ندارد.");
            return;
        }

        setSubmitting(true);
        try {
            const response = await fetch("/api/reviews/submit", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token, reviews: payloadReviews }),
            });
            const json = await readJsonSafe(response);
            if (!response.ok) {
                const message = getErrorMessage(json?.error ?? "ارسال نظر ناموفق بود.");
                setError(message);
                return;
            }
            setNotice("نظرات شما ثبت شد و پس از تایید در صفحه محصول نمایش داده می‌شود.");
            setVerification((prev) =>
                prev
                    ? {
                        ...prev,
                        lines: prev.lines.map((line) =>
                            line.alreadyReviewed ? line : { ...line, alreadyReviewed: true },
                        ),
                    }
                    : prev,
            );
        } catch (err) {
            const message = err instanceof Error ? err.message : "ارسال نظر ناموفق بود.";
            setError(getErrorMessage(message));
        } finally {
            setSubmitting(false);
        }
    };

    useEffect(() => {
        void handleLoad();
    }, []);

    return (
        <Container maxWidth="md" sx={{ my: 4 }}>
            <Card variant="outlined" sx={{ overflow: "hidden" }}>
                <CardHeader
                    title="ثبت نظر برای خرید شما"
                    subheader="لیست محصولات خریداری‌شده شما برای ثبت نظر نمایش داده می‌شود."
                />
                <CardContent>
                    <Stack spacing={3}>
                        {loading ? <Alert severity="info">در حال بارگذاری اطلاعات...</Alert> : null}
                        {error ? <Alert severity="error">{error}</Alert> : null}
                        {notice ? <Alert severity="success">{notice}</Alert> : null}

                        <Divider />

                        {verification ? (
                            <Stack spacing={2}>
                                <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
                                    <Chip label={`فاکتور ${verification.invoiceNumber}`} color="primary" />
                                    {verification.customerName ? (
                                        <Chip label={verification.customerName} variant="outlined" />
                                    ) : null}
                                </Stack>

                                {verification.lines.length === 0 ? (
                                    <Alert severity="info">محصولی برای این فاکتور یافت نشد.</Alert>
                                ) : (
                                    <>
                                        {verification.lines.map((line) => {
                                            const value = values[line.lineKey] ?? { rating: 5, comment: "" };
                                            return (
                                                <Box key={line.lineKey} sx={{ ...layoutStyles, p: 2 }}>
                                                    <Stack
                                                        direction={{ xs: "column", sm: "row" }}
                                                        alignItems={{ xs: "flex-start", sm: "center" }}
                                                        justifyContent="space-between"
                                                        gap={1}
                                                    >
                                                        <Stack spacing={0.5}>
                                                            <Typography fontWeight={700}>{line.productTitle}</Typography>
                                                            {line.variantSummary ? (
                                                                <Typography variant="body2" color="text.secondary">
                                                                    گزینه: {line.variantSummary}
                                                                </Typography>
                                                            ) : null}
                                                            {line.sku ? (
                                                                <Typography variant="caption" color="text.secondary">
                                                                    کد کالا: {line.sku}
                                                                </Typography>
                                                            ) : null}
                                                        </Stack>
                                                        <Button
                                                            component={Link}
                                                            href={`/product/${line.productSlug}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            size="small"
                                                            variant="text"
                                                        >
                                                            مشاهده محصول
                                                        </Button>
                                                    </Stack>

                                                    <Stack
                                                        direction={{ xs: "column", sm: "row" }}
                                                        alignItems={{ xs: "flex-start", sm: "center" }}
                                                        gap={1}
                                                        sx={{ mt: 2 }}
                                                    >
                                                        <Rating
                                                            value={value.rating}
                                                            onChange={(_, next) =>
                                                                setValues((prev) => ({
                                                                    ...prev,
                                                                    [line.lineKey]: {
                                                                        ...value,
                                                                        rating: next ?? value.rating,
                                                                    },
                                                                }))
                                                            }
                                                            readOnly={line.alreadyReviewed}
                                                        />
                                                        {line.alreadyReviewed ? (
                                                            <Chip label="ثبت شده" color="success" size="small" />
                                                        ) : null}
                                                    </Stack>

                                                    <TextField
                                                        label="تجربه شما"
                                                        fullWidth
                                                        multiline
                                                        minRows={3}
                                                        sx={{ mt: 2 }}
                                                        value={value.comment}
                                                        onChange={(e) =>
                                                            setValues((prev) => ({
                                                                ...prev,
                                                                [line.lineKey]: { ...value, comment: e.target.value },
                                                            }))
                                                        }
                                                        placeholder="چطور بود؟ کیفیت، بسته‌بندی، ارسال و ..."
                                                        disabled={line.alreadyReviewed}
                                                    />
                                                </Box>
                                            );
                                        })}

                                        <Button
                                            variant="contained"
                                            color="primary"
                                            onClick={handleSubmit}
                                            disabled={submitting || !hasEditableLines}
                                            sx={{ alignSelf: "flex-start" }}
                                        >
                                            ارسال نظرات
                                        </Button>
                                        {!hasEditableLines ? (
                                            <Typography variant="body2" color="text.secondary">
                                                نظری برای ثبت باقی نمانده است.
                                            </Typography>
                                        ) : null}
                                    </>
                                )}
                            </Stack>
                        ) : (
                            <Typography color="text.secondary">
                                در صورت معتبر بودن لینک، لیست محصولاتی که خریداری کرده‌اید نمایش داده می‌شود.
                            </Typography>
                        )}
                    </Stack>
                </CardContent>
            </Card>
        </Container>
    );
}
