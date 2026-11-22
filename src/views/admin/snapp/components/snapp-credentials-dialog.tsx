"use client";

import { POST } from "@/utils/fetch";
import {
    Button,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    Stack,
    Step,
    StepLabel,
    Stepper,
    TextField,
    Typography,
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import DialogCloseButton from "../../digikala/components/dialog-close-button";
import { summarizeSnappConnection } from "@/snapp/connection-status";

export function maskSnappCredential(value: string): string {
    const trimmed = value.trim();
    if (!trimmed) return "وارد نشده";
    if (trimmed.length <= 6) return "••••••";
    return `${trimmed.slice(0, 3)}••••${trimmed.slice(-3)}`;
}

type Props = {
    open: boolean;
    vendorId: string;
    onClose: () => void;
    onSuccess: (response: unknown) => void;
};

function errorMessage(error: unknown): string {
    const value = error as { data?: unknown; message?: unknown } | null;
    const body = value?.data;
    if (body && typeof body === "object") {
        const bodyRecord = body as { message?: unknown; error?: unknown };
        const message = bodyRecord.message ?? bodyRecord.error;
        if (typeof message === "string" && message.trim()) return message;
    }
    return typeof value?.message === "string" && value.message.trim()
        ? value.message
        : "اعتبارسنجی اتصال اسنپ‌شاپ ناموفق بود";
}

export default function SnappCredentialsDialog({ open, vendorId, onClose, onSuccess }: Props) {
    const [step, setStep] = useState(0);
    const [token, setToken] = useState("");
    const [clientCode, setClientCode] = useState("");
    const [loading, setLoading] = useState(false);
    const steps = ["آماده‌سازی", "اعتبارنامه", "بازبینی و ثبت"];

    useEffect(() => {
        if (!open) return;
        setStep(0);
        setToken("");
        setClientCode("");
        setLoading(false);
    }, [open, vendorId]);

    const canContinue = token.trim().length > 0 && clientCode.trim().length > 0;
    const maskedValues = useMemo(
        () => ({ token: maskSnappCredential(token), clientCode: maskSnappCredential(clientCode) }),
        [token, clientCode],
    );

    async function submit() {
        setLoading(true);
        try {
            const response = await POST("/api/snapp/auth", {
                vendorId,
                token: token.trim(),
                clientCode: clientCode.trim(),
            });
            const summary = summarizeSnappConnection(response as { status?: unknown; data?: unknown });
            if (summary.severity === "warning") toast.warning(summary.message);
            else toast.success(summary.message);
            onSuccess(response);
            onClose();
        } catch (error) {
            toast.error(errorMessage(error));
        } finally {
            setLoading(false);
        }
    }

    function next() {
        if (step === 0) {
            setStep(1);
            return;
        }
        if (step === 1) {
            if (!canContinue) {
                toast.error("توکن و کد یکتای اسنپ‌شاپ را وارد کنید");
                return;
            }
            setStep(2);
        }
    }

    return (
        <Dialog open={open} onClose={loading ? undefined : onClose} fullWidth maxWidth="sm" dir="rtl">
            <DialogTitle sx={{ position: "relative", pr: 6 }}>
                اتصال مرحله‌ای اسنپ‌شاپ
                <DialogCloseButton onClose={onClose} disabled={loading} />
            </DialogTitle>
            <DialogContent>
                <Stepper activeStep={step} alternativeLabel sx={{ mb: 3 }}>
                    {steps.map((label) => (
                        <Step key={label}><StepLabel>{label}</StepLabel></Step>
                    ))}
                </Stepper>

                {step === 0 && (
                    <Stack spacing={2}>
                        <Typography variant="h6">آماده‌سازی اتصال</Typography>
                        <Typography color="text.secondary">
                            اعتبارنامه برای پروفایل داخلی «{vendorId}» ثبت می‌شود. اطلاعات محرمانه در
                            خلاصهٔ نهایی نمایش داده نمی‌شود.
                        </Typography>
                    </Stack>
                )}

                {step === 1 && (
                    <Stack spacing={2}>
                        <Typography variant="h6">ورود امن اعتبارنامه</Typography>
                        <TextField
                            label="توکن اسنپ‌شاپ"
                            value={token}
                            onChange={(event) => setToken(event.target.value)}
                            type="password"
                            fullWidth
                            autoFocus
                            autoComplete="new-password"
                            inputProps={{ dir: "ltr" }}
                        />
                        <TextField
                            label="کد یکتای اسنپ‌شاپ (User-Agent)"
                            value={clientCode}
                            onChange={(event) => setClientCode(event.target.value)}
                            type="password"
                            fullWidth
                            autoComplete="new-password"
                            inputProps={{ dir: "ltr" }}
                        />
                        <Typography variant="caption" color="text.secondary">
                            کد یکتا همان مقدار User-Agent پنل فروشندگان اسنپ‌شاپ است؛ نام کاربری یا رمز
                            ورود پنل را وارد نکنید.
                        </Typography>
                    </Stack>
                )}

                {step === 2 && (
                    <Stack spacing={2}>
                        <Typography variant="h6">بازبینی قبل از ثبت</Typography>
                        <Stack spacing={1} sx={{ p: 2, bgcolor: "action.hover", borderRadius: 1 }}>
                            <Typography>شناسهٔ پروفایل: {vendorId}</Typography>
                            <Typography>توکن: {maskedValues.token}</Typography>
                            <Typography>کد یکتا: {maskedValues.clientCode}</Typography>
                        </Stack>
                        <Divider />
                        <Typography variant="body2" color="text.secondary">
                            ابتدا اعتبارنامه در اسنپ‌شاپ بررسی و سپس فقط در صورت موفقیت در پنل ذخیره می‌شود.
                        </Typography>
                    </Stack>
                )}
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
                <Button disabled={loading} onClick={step === 0 ? onClose : () => setStep((value) => value - 1)}>
                    {step === 0 ? "انصراف" : "مرحله قبل"}
                </Button>
                {step < 2 ? (
                    <Button variant="contained" disabled={loading || (step === 1 && !canContinue)} onClick={next}>
                        مرحله بعد
                    </Button>
                ) : (
                    <Button variant="contained" disabled={loading} onClick={submit}>
                        {loading && <CircularProgress size={16} sx={{ ml: 1 }} />}
                        اعتبارسنجی و ثبت
                    </Button>
                )}
            </DialogActions>
        </Dialog>
    );
}
