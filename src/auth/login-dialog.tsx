"use client";

import {
  createContext, useCallback, useContext, useEffect, useRef, useState,
  type ReactNode, type KeyboardEvent, type ClipboardEvent,
} from "react";
import {
  Alert, Box, Button, CircularProgress, Dialog, DialogContent,
  IconButton, Stack, TextField, Typography,
} from "@mui/material";
import { Lock, X } from "lucide-react";
import { useAuth, useLogin } from "@/auth";
import { OTP_LENGTH, OTP_PATTERN } from "@/auth/otp";
import BrandLockup from "@/components/brand-lockup";
import { TEB_COLORS, TEB_RADII } from "@/theme/tokens";

/** Persian/Arabic digits → Latin. */
function toLatin(s: string): string {
  return s
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
}

// ─── Context ─────────────────────────────────────────────────────────────────

type LoginDialogContextValue = {
  /** Open the login modal; runs onSuccess after a successful login. */
  openLogin: (onSuccess?: () => void) => void;
};

const LoginDialogContext = createContext<LoginDialogContextValue | null>(null);

export function useLoginDialog(): LoginDialogContextValue {
  const ctx = useContext(LoginDialogContext);
  if (!ctx) throw new Error("useLoginDialog must be used within LoginDialogProvider");
  return ctx;
}

// ─── OTP (clean, LTR, Persian-digit aware) ───────────────────────────────────

function OtpBoxes({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length: OTP_LENGTH }, (_, i) => value[i] ?? "");

  useEffect(() => {
    const t = setTimeout(() => {
      const firstEmpty = Math.min(value.replace(/\D/g, "").length, OTP_LENGTH - 1);
      refs.current[firstEmpty]?.focus();
    }, 60);
    return () => clearTimeout(t);
  }, []);

  function clean(raw: string) { return toLatin(raw).replace(/\D/g, ""); }
  function focus(i: number) { refs.current[Math.max(0, Math.min(OTP_LENGTH - 1, i))]?.focus(); }

  function change(i: number, raw: string) {
    const c = clean(raw);
    if (!c) return;
    if (c.length > 1) { const n = (value.slice(0, i) + c).slice(0, OTP_LENGTH); onChange(n); focus(n.length); return; }
    const n = (value.slice(0, i) + c + value.slice(i + 1)).slice(0, OTP_LENGTH);
    onChange(n);
    if (i < OTP_LENGTH - 1) focus(i + 1);
  }
  function key(i: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace") {
      e.preventDefault();
      if (value[i]) onChange(value.slice(0, i) + value.slice(i + 1));
      else if (i > 0) { onChange(value.slice(0, i - 1) + value.slice(i)); focus(i - 1); }
    } else if (e.key === "ArrowLeft" && i > 0) focus(i - 1);
    else if (e.key === "ArrowRight" && i < OTP_LENGTH - 1) focus(i + 1);
  }
  function paste(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const p = clean(e.clipboardData.getData("text")).slice(0, OTP_LENGTH);
    onChange(p); focus(p.length);
  }

  return (
    <Box dir="ltr" style={{ direction: "ltr" }} sx={{ display: "flex", gap: 1, justifyContent: "center" }}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          value={d}
          onChange={(e) => change(i, e.target.value)}
          onKeyDown={(e) => key(i, e)}
          onPaste={paste}
          disabled={disabled}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={1}
          aria-label={`رقم ${i + 1}`}
          style={{
            width: 48,
            height: 54,
            textAlign: "center",
            fontSize: "1.4rem",
            fontWeight: 700,
            fontFamily: "monospace",
            border: `1.5px solid ${d ? TEB_COLORS.primary : TEB_COLORS.border}`,
            backgroundColor: d ? TEB_COLORS.surfaceSoft : "#FFFFFF",
            color: TEB_COLORS.textPrimary,
            borderRadius: TEB_RADII.md,
            outline: "none",
            direction: "ltr",
          }}
        />
      ))}
    </Box>
  );
}

// ─── Provider + Dialog ───────────────────────────────────────────────────────

export function LoginDialogProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const onSuccessRef = useRef<(() => void) | null>(null);
  const wasOpenRef = useRef(false);

  const { status } = useAuth();
  const {
    phone, code, step, error, isSubmitting,
    setPhone, setCode, requestCode, verifyCode, reset,
  } = useLogin();

  const isCodeStep = step === "code-sent" || step === "verifying";
  const lastTriedRef = useRef("");

  const openLogin = useCallback((onSuccess?: () => void) => {
    onSuccessRef.current = onSuccess ?? null;
    reset();
    setOpen(true);
  }, [reset]);

  const close = useCallback(() => { setOpen(false); reset(); }, [reset]);

  useEffect(() => {
    if (open) wasOpenRef.current = true;
    if (wasOpenRef.current && status === "authenticated") {
      wasOpenRef.current = false;
      const cb = onSuccessRef.current;
      onSuccessRef.current = null;
      setOpen(false);
      reset();
      cb?.();
    }
  }, [status, open, reset]);

  useEffect(() => {
    if (code.length < OTP_LENGTH) { lastTriedRef.current = ""; return; }
    if (OTP_PATTERN.test(code) && step === "code-sent" && !isSubmitting && code !== lastTriedRef.current) {
      lastTriedRef.current = code;
      void verifyCode(code);
    }
  }, [code, step, isSubmitting, verifyCode]);

  return (
    <LoginDialogContext.Provider value={{ openLogin }}>
      {children}
      <Dialog
        open={open}
        onClose={() => !isSubmitting && close()}
        maxWidth={false}
        scroll="paper"
        slotProps={{
          paper: {
            sx: {
              width: "min(460px, calc(100vw - 24px))",
              maxWidth: "460px",
              maxHeight: "calc(100dvh - 24px)",
              m: 1.5,
              borderRadius: `${TEB_RADII.lg}px`,
              overflow: "hidden",
              border: `1px solid ${TEB_COLORS.border}`,
              bgcolor: "#FFFFFF",
              boxShadow: "0 28px 80px -40px rgba(31,70,53,.65)",
            },
          },
        }}
      >
        <Box sx={{ height: 4, bgcolor: TEB_COLORS.primary }} />
        <DialogContent sx={{ p: { xs: 2.5, sm: 3.5 }, position: "relative", overflowY: "auto" }}>
          <IconButton
            size="small"
            onClick={close}
            disabled={isSubmitting}
            sx={{ position: "absolute", insetInlineEnd: 12, top: 12, width: 40, height: 40 }}
            aria-label="بستن"
          >
            <X size={18} />
          </IconButton>

          <Stack spacing={2.5}>
            <Stack spacing={1.25} alignItems="center" textAlign="center">
              <BrandLockup size={42} compact />
              <Box
                sx={{
                  width: 52,
                  height: 52,
                  borderRadius: "50%",
                  display: "grid",
                  placeItems: "center",
                  bgcolor: TEB_COLORS.surfaceSoft,
                  border: `1px solid ${TEB_COLORS.border}`,
                  color: TEB_COLORS.primary,
                }}
              >
                <Lock size={22} />
              </Box>
              <Typography variant="h6" fontWeight={800} color={TEB_COLORS.textPrimary}>
                {isCodeStep ? "کد تأیید" : "ورود / ثبت‌نام"}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {isCodeStep
                  ? <>کد {OTP_LENGTH} رقمی ارسال‌شده به <Box component="span" dir="ltr" sx={{ fontWeight: 700, color: TEB_COLORS.textPrimary }}>{phone}</Box> را وارد کنید.</>
                  : "برای ادامه، شماره موبایل خود را وارد کنید."}
              </Typography>
            </Stack>

            {error && <Alert severity="error" sx={{ borderRadius: `${TEB_RADII.md}px` }}>{error}</Alert>}

            {!isCodeStep ? (
              <Box component="form" onSubmit={(e) => { e.preventDefault(); void requestCode(phone); }}>
                <Stack spacing={2}>
                  <TextField
                    label="شماره موبایل"
                    type="tel"
                    value={phone}
                    onChange={(e) => {
                      const latin = toLatin(e.target.value);
                      const plus = latin.trimStart().startsWith("+") ? "+" : "";
                      setPhone(plus + latin.replace(/\D/g, ""));
                    }}
                    fullWidth autoFocus required
                    placeholder="09123456789"
                    disabled={isSubmitting}
                    inputProps={{ inputMode: "numeric", dir: "ltr", style: { direction: "ltr", textAlign: "left", letterSpacing: 1, unicodeBidi: "plaintext" } }}
                  />
                  <Button
                    type="submit"
                    variant="contained"
                    size="large"
                    disabled={isSubmitting || !phone.trim()}
                    sx={{
                      borderRadius: `${TEB_RADII.pill}px`,
                      minHeight: 46,
                      fontWeight: 700,
                      bgcolor: TEB_COLORS.primary,
                      "&:hover": { bgcolor: TEB_COLORS.primaryDark },
                    }}
                  >
                    {isSubmitting ? <CircularProgress size={22} color="inherit" /> : "ارسال کد تأیید"}
                  </Button>
                </Stack>
              </Box>
            ) : (
              <Stack spacing={2}>
                <OtpBoxes value={code} onChange={setCode} disabled={isSubmitting} />
                <Button
                  variant="contained"
                  size="large"
                  onClick={() => verifyCode(code)}
                  disabled={isSubmitting || !OTP_PATTERN.test(code)}
                  sx={{
                    borderRadius: `${TEB_RADII.pill}px`,
                    minHeight: 46,
                    fontWeight: 700,
                    bgcolor: TEB_COLORS.primary,
                    "&:hover": { bgcolor: TEB_COLORS.primaryDark },
                  }}
                >
                  {isSubmitting ? <CircularProgress size={22} color="inherit" /> : "تأیید و ورود"}
                </Button>
                <Button
                  size="small"
                  color="inherit"
                  onClick={() => { setCode(""); reset(); }}
                  disabled={isSubmitting}
                  sx={{ minHeight: 44 }}
                >
                  تغییر شماره
                </Button>
              </Stack>
            )}
          </Stack>
        </DialogContent>
      </Dialog>
    </LoginDialogContext.Provider>
  );
}

