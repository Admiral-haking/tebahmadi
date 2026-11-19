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
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import SmsOutlinedIcon from "@mui/icons-material/SmsOutlined";
import { useAuth, useLogin } from "@/auth";

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
    // `value` is a plain contiguous string of up to 6 ASCII digits. Box i shows
    // value[i]; the code always fills left-to-right.
    const digits = Array.from({ length: 6 }, (_, i) => value[i] ?? '');

    /** Persian/Arabic-Indic digits → Latin, keep digits only. */
    function cleanDigits(raw: string): string {
        return raw
            .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
            .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
            .replace(/\D/g, '');
    }

    function focusBox(i: number) {
        refs.current[Math.max(0, Math.min(5, i))]?.focus();
    }

    function handleChange(i: number, raw: string) {
        const cleaned = cleanDigits(raw);
        if (!cleaned) return;
        if (cleaned.length > 1) {
            // A whole code typed/autofilled into one box → spread from here.
            const next = (value.slice(0, i) + cleaned).slice(0, 6);
            onChange(next);
            focusBox(next.length);
            return;
        }
        // Replace this box's digit, keep the rest in place.
        const next = (value.slice(0, i) + cleaned + value.slice(i + 1)).slice(0, 6);
        onChange(next);
        if (i < 5) focusBox(i + 1);
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
        } else if (e.key === 'ArrowRight' && i < 5) {
            focusBox(i + 1);
        }
    }

    function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
        e.preventDefault();
        const pasted = cleanDigits(e.clipboardData.getData('text')).slice(0, 6);
        onChange(pasted);
        focusBox(pasted.length);
    }

    return (
        <Box
            dir="ltr"
            // Inline style — the app's stylis-plugin-rtl flips `direction` set via
            // `sx`, which is exactly what made the boxes fill right-to-left.
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

                // Palette-var based so the boxes follow the active theme (the
                // vars swap automatically between light/dark color schemes).
                let borderColor = 'var(--mui-palette-divider)';
                let bgColor = 'var(--mui-palette-background-paper)';
                let textColor = 'var(--mui-palette-text-primary)';
                let shadow = 'none';

                if (hasError) {
                    borderColor = 'var(--mui-palette-error-main)';
                    bgColor = 'rgba(var(--mui-palette-error-mainChannel) / 0.08)';
                    textColor = 'var(--mui-palette-error-main)';
                    if (isFocused) shadow = '0 0 0 4px rgba(var(--mui-palette-error-mainChannel) / 0.15)';
                } else if (isVerifying) {
                    borderColor = 'var(--mui-palette-success-main)';
                    bgColor = 'rgba(var(--mui-palette-success-mainChannel) / 0.08)';
                    textColor = 'var(--mui-palette-success-main)';
                    if (isFocused) shadow = '0 0 0 4px rgba(var(--mui-palette-success-mainChannel) / 0.15)';
                } else if (isFocused) {
                    borderColor = 'var(--mui-palette-primary-main)';
                    bgColor = `rgba(var(--mui-palette-primary-mainChannel) / ${isFilled ? 0.08 : 0.04})`;
                    shadow = '0 0 0 4px rgba(var(--mui-palette-primary-mainChannel) / 0.15)';
                } else if (isFilled) {
                    borderColor = 'var(--mui-palette-primary-light)';
                    bgColor = 'rgba(var(--mui-palette-primary-mainChannel) / 0.08)';
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
                            width: '48px',
                            height: '58px',
                            textAlign: 'center',
                            fontSize: '1.5rem',
                            fontWeight: 700,
                            fontFamily: 'monospace',
                            border: `2px solid ${borderColor}`,
                            borderRadius: '14px',
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
        setPhone, setCode, requestCode, verifyCode, reset,
    } = useLogin();

    const isCodeStep = step === "code-sent" || step === "verifying";
    const [resendIn, setResendIn] = useState(0);
    // Remember the last auto-submitted code so a wrong code isn't resubmitted in a
    // loop (which previously froze the page after a failed verification).
    const lastTriedRef = useRef<string>("");

    useEffect(() => {
        if (status === "authenticated" && user) {
            reset();
            router.replace(redirectTarget);
        }
    }, [status, user, router, reset, redirectTarget]);

    // Start/refresh the resend cooldown whenever a code is freshly sent.
    useEffect(() => {
        if (step === "code-sent") setResendIn((s) => (s > 0 ? s : RESEND_SECONDS));
    }, [step]);

    useEffect(() => {
        if (resendIn <= 0) return;
        const t = setInterval(() => setResendIn((s) => Math.max(0, s - 1)), 1000);
        return () => clearInterval(t);
    }, [resendIn]);

    // Auto-submit once when all 6 digits are entered. Reset the guard whenever the
    // code drops below 6 so a corrected code (even the same one) submits again,
    // but a failed 6-digit code is never resubmitted on its own.
    useEffect(() => {
        if (code.length < 6) { lastTriedRef.current = ""; return; }
        if (/^\d{6}$/.test(code) && step === "code-sent" && !isSubmitting && code !== lastTriedRef.current) {
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
                minHeight: "100dvh",
                display: "flex",
                alignItems: "center",
                // Theme-palette based so it always matches the active theme (any
                // light/dark palette), instead of hard-coded colors.
                bgcolor: "background.default",
                backgroundImage:
                    "radial-gradient(1200px 600px at 50% -10%, rgba(var(--mui-palette-primary-mainChannel) / 0.12) 0%, rgba(var(--mui-palette-primary-mainChannel) / 0) 55%)",
            }}
        >
            <Container maxWidth="xs" sx={{ py: { xs: 5, md: 8 } }}>
                <Paper
                    elevation={0}
                    sx={{
                        borderRadius: 4,
                        p: { xs: 3, sm: 4 },
                        border: "1px solid",
                        borderColor: "divider",
                        boxShadow: "0 12px 40px -12px rgba(var(--mui-palette-common-onBackgroundChannel) / 0.4)",
                        backgroundColor: "background.paper",
                    }}
                >
                    <Stack spacing={3}>
                        {/* Header */}
                        <Stack spacing={1.5} alignItems="center" textAlign="center">
                            <Box
                                sx={{
                                    width: 60,
                                    height: 60,
                                    borderRadius: "50%",
                                    display: "grid",
                                    placeItems: "center",
                                    color: "var(--mui-palette-common-white)",
                                    background: "linear-gradient(135deg, var(--mui-palette-primary-main), var(--mui-palette-secondary-main))",
                                    boxShadow: "0 8px 20px -6px rgba(var(--mui-palette-primary-mainChannel) / 0.6)",
                                }}
                            >
                                {isCodeStep ? <SmsOutlinedIcon /> : <LockOutlinedIcon />}
                            </Box>
                            <Typography variant="h5" component="h1" fontWeight={800}>
                                {isCodeStep ? "تایید شماره موبایل" : "ورود یا ثبت‌نام"}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                {isCodeStep ? (
                                    <>
                                        کد ۶ رقمی ارسال‌شده به{" "}
                                        <Box component="span" dir="ltr" sx={{ fontWeight: 700, fontFamily: "monospace" }}>
                                            {phone}
                                        </Box>{" "}
                                        را وارد کنید.
                                    </>
                                ) : (
                                    "برای ادامه، شماره موبایل خود را وارد کنید تا یک کد تایید برایتان ارسال شود."
                                )}
                            </Typography>
                        </Stack>

                        {error ? (
                            <Alert severity="error" sx={{ textAlign: "right", borderRadius: 2 }}>
                                {error}
                            </Alert>
                        ) : null}

                        {/* Phone step */}
                        {!isCodeStep ? (
                            <Box component="form" onSubmit={handlePhoneSubmit} textAlign="right">
                                <Stack spacing={2}>
                                    <TextField
                                        label="شماره موبایل"
                                        type="tel"
                                        value={phone}
                                        onChange={e => {
                                            // Persian/Arabic digits → Latin; keep an optional leading
                                            // "+" then digits only. Clean and LTR so it never reverses.
                                            const latin = e.target.value
                                                .replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
                                                .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
                                            const plus = latin.trimStart().startsWith('+') ? '+' : '';
                                            setPhone(plus + latin.replace(/\D/g, ''));
                                        }}
                                        fullWidth
                                        autoFocus
                                        disabled={isSubmitting && step === "requesting"}
                                        placeholder="مثال: 09031234567"
                                        helperText="می‌توانید شماره را با 0 یا +98 وارد کنید."
                                        FormHelperTextProps={{ sx: { textAlign: "right" } }}
                                        inputProps={{
                                            inputMode: "numeric",
                                            dir: "ltr",
                                            // Inline style only — `sx` direction/textAlign get flipped
                                            // by stylis-plugin-rtl, which reversed the number.
                                            style: { direction: "ltr", textAlign: "left", letterSpacing: 1, unicodeBidi: "plaintext" },
                                        }}
                                        required
                                    />
                                    <Button
                                        type="submit"
                                        variant="contained"
                                        size="large"
                                        disabled={isSubmitting || !phone.trim()}
                                        sx={{ borderRadius: 2, py: 1.25, fontWeight: 700 }}
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
                                        disabled={isSubmitting || code.trim().length !== 6}
                                        color={isVerifying ? "success" : "primary"}
                                        fullWidth
                                        sx={{ borderRadius: 2, py: 1.25, fontWeight: 700 }}
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
                                        >
                                            ویرایش شماره
                                        </Link>
                                        {resendIn > 0 ? (
                                            <Typography variant="caption" color="text.secondary">
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
                    mt={3}
                >
                    با ورود، قوانین و حریم خصوصی را می‌پذیرید.
                </Typography>
            </Container>
        </Box>
    );
}
