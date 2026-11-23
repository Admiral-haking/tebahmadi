'use client';

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
    Alert,
    Box,
    Button,
    Container,
    Link,
    Paper,
    Stack,
    TextField,
    Typography,
} from "@mui/material";
import { Lock, MessageSquare } from "lucide-react";
import { useAuth, useLogin } from "@/auth";
import { OTP_LENGTH, OTP_PATTERN } from "@/auth/otp";
import BrandLockup from "@/components/brand-lockup";
import { TEB_COLORS, TEB_RADII } from "@/theme/tokens";

// ─── OTP Input ───────────────────────────────────────────────────────────────
// The whole block is locked to LTR: a verification code reads left-to-right even
// on an RTL page, so the first digit must sit in the LEFT-most box. Each <input>
// also carries dir="ltr" so the digit/caret never flips inside RTL inheritance.

function OtpInput({
    value,
    onChange,
    disabled,
    hasError,
    isVerifying,
}: {
    value: string;
    onChange: (v: string) => void;
    disabled: boolean;
    hasError: boolean;
    isVerifying: boolean;
}) {
    const refs = useRef<(HTMLInputElement | null)[]>([]);
    const [focused, setFocused] = useState<number | null>(null);
    const digits = Array.from({ length: OTP_LENGTH }, (_, i) => value[i] ?? '');

    /** Persian/Arabic-Indic digits → Latin, keep digits only. */
    function cleanDigits(raw: string): string {
        return raw
            .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
            .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
            .replace(/\D/g, '');
    }

    function focusBox(i: number) {
        refs.current[Math.max(0, Math.min(OTP_LENGTH - 1, i))]?.focus();
    }

    function handleChange(i: number, raw: string) {
        const cleaned = cleanDigits(raw);
        if (!cleaned) return;
        if (cleaned.length > 1) {
            const next = (value.slice(0, i) + cleaned).slice(0, OTP_LENGTH);
            onChange(next);
            focusBox(next.length);
            return;
        }
        const next = (value.slice(0, i) + cleaned + value.slice(i + 1)).slice(0, OTP_LENGTH);
        onChange(next);
        if (i < OTP_LENGTH - 1) focusBox(i + 1);
    }

    function handleKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key === 'Backspace') {
            e.preventDefault();
            if (value[i]) {
                onChange(value.slice(0, i) + value.slice(i + 1));
            } else if (i > 0) {
                onChange(value.slice(0, i - 1) + value.slice(i));
                focusBox(i - 1);
            }
        } else if (e.key === 'ArrowLeft' && i > 0) {
            focusBox(i - 1);
        } else if (e.key === 'ArrowRight' && i < OTP_LENGTH - 1) {
            focusBox(i + 1);
        }
    }

    function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
        e.preventDefault();
        const pasted = cleanDigits(e.clipboardData.getData('text')).slice(0, OTP_LENGTH);
        onChange(pasted);
        focusBox(pasted.length);
    }

    return (
        <Box
            dir="ltr"
            style={{ direction: 'ltr' }}
            sx={{
                display: 'flex',
                gap: { xs: 1, sm: 1.25 },
                justifyContent: 'center',
            }}
        >
            {digits.map((digit, i) => {
                const isFilled = digit !== '';
                const isFocused = focused === i;

                let borderColor: string = TEB_COLORS.border;
                let bgColor = '#FFFFFF';
                let textColor: string = TEB_COLORS.textPrimary;
                let shadow = 'none';

                if (hasError) {
                    borderColor = TEB_COLORS.error;
                    bgColor = 'rgba(165, 74, 76, 0.06)';
                    textColor = TEB_COLORS.error;
                    if (isFocused) shadow = '0 0 0 3px rgba(165, 74, 76, 0.16)';
                } else if (isVerifying) {
                    borderColor = TEB_COLORS.primary;
                    bgColor = 'rgba(42, 90, 68, 0.08)';
                    textColor = TEB_COLORS.primary;
                    if (isFocused) shadow = '0 0 0 3px rgba(42, 90, 68, 0.18)';
                } else if (isFocused) {
                    borderColor = TEB_COLORS.primary;
                    bgColor = 'rgba(42, 90, 68, 0.04)';
                    shadow = '0 0 0 3px rgba(42, 90, 68, 0.15)';
                } else if (isFilled) {
                    borderColor = TEB_COLORS.primary;
                    bgColor = TEB_COLORS.surfaceSoft;
                }

                return (
                    <input
                        key={i}
                        ref={el => { refs.current[i] = el; }}
                        value={digit}
                        onChange={e => handleChange(i, e.target.value)}
                        onKeyDown={e => handleKeyDown(i, e)}
                        onPaste={handlePaste}
                        onFocus={() => setFocused(i)}
                        onBlur={() => setFocused(null)}
                        disabled={disabled}
                        dir="ltr"
                        inputMode="numeric"
                        autoComplete={i === 0 ? 'one-time-code' : 'off'}
                        maxLength={1}
                        aria-label={`رقم ${i + 1}`}
                        style={{
                            width: '52px',
                            height: '58px',
                            textAlign: 'center',
                            fontSize: '1.45rem',
                            fontWeight: 700,
                            fontFamily: 'monospace',
                            border: `1.5px solid ${borderColor}`,
                            borderRadius: `${TEB_RADII.md}px`,
                            outline: 'none',
                            backgroundColor: bgColor,
                            color: textColor,
                            boxShadow: shadow,
                            transition: 'border-color .15s, background-color .15s, box-shadow .15s, color .15s',
                            cursor: disabled ? 'not-allowed' : 'text',
                            opacity: disabled ? 0.65 : 1,
                        }}
                    />
                );
            })}
        </Box>
    );
}
const RESEND_SECONDS = 60;

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AuthPageClient() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const redirectParam = searchParams?.get("redirect");
    const redirectTarget = useMemo(() => {
        if (!redirectParam) return "/";
        const trimmed = redirectParam.trim();
        if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return "/";
        return trimmed;
    }, [redirectParam]);

    const { user, status } = useAuth();
    const {
        phone, code, step, error, isSubmitting,
        manualCode, setPhone, setCode, requestCode, verifyCode, reset,
    } = useLogin();

    const isCodeStep = step === "code-sent" || step === "verifying";
    const [resendIn, setResendIn] = useState(0);
    const lastTriedRef = useRef<string>("");

    useEffect(() => {
        if (status === "authenticated" && user) {
            reset();
            router.replace(redirectTarget);
        }
    }, [status, user, router, reset, redirectTarget]);

    useEffect(() => {
        if (step === "code-sent") setResendIn((s) => (s > 0 ? s : RESEND_SECONDS));
    }, [step]);

    useEffect(() => {
        if (resendIn <= 0) return;
        const t = setInterval(() => setResendIn((s) => Math.max(0, s - 1)), 1000);
        return () => clearInterval(t);
    }, [resendIn]);

    useEffect(() => {
        if (code.length < OTP_LENGTH) { lastTriedRef.current = ""; return; }
        if (OTP_PATTERN.test(code) && step === "code-sent" && !isSubmitting && code !== lastTriedRef.current) {
            lastTriedRef.current = code;
            void verifyCode(code);
        }
    }, [code, step, isSubmitting, verifyCode]);

    const handlePhoneSubmit = (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        void requestCode(phone);
    };

    const handleCodeSubmit = (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        void verifyCode(code);
    };

    const handleResend = useCallback(() => {
        if (resendIn > 0 || isSubmitting) return;
        setResendIn(RESEND_SECONDS);
        void requestCode(phone);
    }, [resendIn, isSubmitting, requestCode, phone]);

    const editPhone = useCallback(() => {
        setCode("");
        reset();
    }, [setCode, reset]);

    const isVerifying = step === "verifying" && isSubmitting;
    const hasCodeError = !!error && isCodeStep;

    return (
        <Box
            sx={{
                minHeight: "calc(100dvh - 140px)",
                display: "flex",
                alignItems: "center",
                bgcolor: TEB_COLORS.background,
            }}
        >
            <Container maxWidth="xs" sx={{ py: { xs: 5, md: 8 } }}>
                <Paper
                    elevation={0}
                    sx={{
                        borderRadius: `${TEB_RADII.lg}px`,
                        p: { xs: 3, sm: 4 },
                        border: `1px solid ${TEB_COLORS.border}`,
                        backgroundColor: "#FFFFFF",
                        boxShadow: "0 14px 36px rgba(33, 73, 54, 0.06)",
                    }}
                >
                    <Stack spacing={3}>
                        {/* Header */}
                        <Stack spacing={1.5} alignItems="center" textAlign="center">
                            <BrandLockup size={48} compact />
                            <Box
                                sx={{
                                    width: 58,
                                    height: 58,
                                    borderRadius: "50%",
                                    display: "grid",
                                    placeItems: "center",
                                    color: TEB_COLORS.primary,
                                    bgcolor: TEB_COLORS.surfaceSoft,
                                    border: `1px solid ${TEB_COLORS.border}`,
                                }}
                            >
                                {isCodeStep ? <MessageSquare size={24} /> : <Lock size={24} />}
                            </Box>
                            <Typography variant="h5" component="h1" fontWeight={800} color={TEB_COLORS.textPrimary}>
                                {isCodeStep ? "تایید شماره موبایل" : "ورود یا ثبت‌نام در طب احمدی"}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.75 }}>
                                {isCodeStep ? (
                                    <>
                                        {manualCode ? "کد ورود ثبت‌شده را وارد کنید." : <>کد {OTP_LENGTH} رقمی ارسال‌شده به{" "}
                                        <Box component="span" dir="ltr" sx={{ fontWeight: 700, fontFamily: "monospace", color: TEB_COLORS.textPrimary }}>
                                            {phone}
                                        </Box>{" "}
                                        را وارد کنید.</>}
                                    </>
                                ) : (
                                    "برای پیگیری سفارش‌ها و ثبت خرید، شماره موبایل خود را وارد کنید."
                                )}
                            </Typography>
                        </Stack>

                        {error ? (
                            <Alert severity="error" sx={{ textAlign: "right", borderRadius: `${TEB_RADII.md}px` }}>
                                {error}
                            </Alert>
                        ) : null}

                        {/* Phone step */}
                        {!isCodeStep ? (
                            <Box component="form" onSubmit={handlePhoneSubmit} textAlign="right">
                                <Stack spacing={2.25}>
                                    <TextField
                                        label="شماره موبایل"
                                        type="tel"
                                        value={phone}
                                        onChange={e => {
                                            const latin = e.target.value
                                                .replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
                                                .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
                                            const plus = latin.trimStart().startsWith('+') ? '+' : '';
                                            setPhone(plus + latin.replace(/\D/g, ''));
                                        }}
                                        fullWidth
                                        autoFocus
                                        disabled={isSubmitting && step === "requesting"}
                                        placeholder="شماره موبایل خود را وارد کنید"
                                        helperText="می‌توانید شماره را با 0 یا +98 وارد کنید."
                                        FormHelperTextProps={{ sx: { textAlign: "right" } }}
                                        inputProps={{
                                            inputMode: "numeric",
                                            dir: "ltr",
                                            style: { direction: "ltr", textAlign: "left", letterSpacing: 1, unicodeBidi: "plaintext" },
                                        }}
                                        required
                                    />
                                    <Button
                                        type="submit"
                                        variant="contained"
                                        size="large"
                                        disabled={isSubmitting || !phone.trim()}
                                        sx={{
                                            borderRadius: `${TEB_RADII.pill}px`,
                                            minHeight: 48,
                                            fontWeight: 700,
                                            bgcolor: TEB_COLORS.primary,
                                            "&:hover": { bgcolor: TEB_COLORS.primaryDark },
                                        }}
                                    >
                                        {step === "requesting" ? "در حال ارسال..." : "ارسال کد تایید"}
                                    </Button>
                                </Stack>
                            </Box>
                        ) : (
                            /* Code step */
                            <Box component="form" onSubmit={handleCodeSubmit}>
                                <Stack spacing={2.5}>
                                    <OtpInput
                                        value={code}
                                        onChange={setCode}
                                        disabled={isSubmitting}
                                        hasError={hasCodeError}
                                        isVerifying={isVerifying}
                                    />

                                    <Button
                                        type="submit"
                                        variant="contained"
                                        size="large"
                                        disabled={isSubmitting || code.trim().length !== OTP_LENGTH}
                                        fullWidth
                                        sx={{
                                            borderRadius: `${TEB_RADII.pill}px`,
                                            minHeight: 48,
                                            fontWeight: 700,
                                            bgcolor: TEB_COLORS.primary,
                                            "&:hover": { bgcolor: TEB_COLORS.primaryDark },
                                        }}
                                    >
                                        {step === "verifying" ? "در حال ورود..." : "تایید و ورود"}
                                    </Button>

                                    <Stack
                                        direction="row"
                                        justifyContent="space-between"
                                        alignItems="center"
                                    >
                                        <Link
                                            component="button"
                                            type="button"
                                            variant="caption"
                                            onClick={editPhone}
                                            underline="hover"
                                            disabled={isSubmitting}
                                            sx={{ color: TEB_COLORS.primary, fontWeight: 600, minHeight: 44 }}
                                        >
                                            ویرایش شماره
                                        </Link>
                                        {resendIn > 0 ? (
                                            <Typography variant="caption" color="text.secondary" sx={{ fontVariantNumeric: "tabular-nums" }}>
                                                ارسال مجدد تا {resendIn.toLocaleString("fa-IR")} ثانیه دیگر
                                            </Typography>
                                        ) : (
                                            <Link
                                                component="button"
                                                type="button"
                                                variant="caption"
                                                onClick={handleResend}
                                                underline="hover"
                                                disabled={isSubmitting}
                                                sx={{ color: TEB_COLORS.primary, fontWeight: 600, minHeight: 44 }}
                                            >
                                                ارسال مجدد کد
                                            </Link>
                                        )}
                                    </Stack>
                                </Stack>
                            </Box>
                        )}
                    </Stack>
                </Paper>

                <Typography
                    variant="caption"
                    color="text.secondary"
                    display="block"
                    textAlign="center"
                    mt={2.5}
                >
                    با ورود، قوانین و حریم خصوصی فروشگاه طب احمدی را می‌پذیرید.
                </Typography>
            </Container>
        </Box>
    );
}
