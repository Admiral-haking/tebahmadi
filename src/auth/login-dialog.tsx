"use client";

import {
  createContext, useCallback, useContext, useEffect, useRef, useState,
  type ReactNode, type KeyboardEvent, type ClipboardEvent,
} from "react";
import {
  Alert, Box, Button, CircularProgress, Dialog, DialogContent,
  IconButton, Stack, TextField, Typography,
} from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import { useAuth, useLogin } from "@/auth";
import { OTP_LENGTH, OTP_PATTERN } from "@/auth/otp";

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

  // When the code step appears, put the cursor in the first empty box so the
  // user can type the code immediately. A short delay lets the dialog finish
  // mounting/animating so the focus reliably lands (no missed focus).
  useEffect(() => {
    const t = setTimeout(() => {
      const firstEmpty = Math.min(value.replace(/\D/g, "").length, OTP_LENGTH - 1);
      refs.current[firstEmpty]?.focus();
    }, 60);
    return () => clearTimeout(t);
    // run once on mount (i.e. when the code step is shown)
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
            width: 44, height: 54, textAlign: "center", fontSize: "1.4rem", fontWeight: 700,
            fontFamily: "monospace", border: "2px solid", borderColor: d ? "var(--mui-palette-primary-light)" : "var(--mui-palette-divider)",
            borderRadius: 12, outline: "none", direction: "ltr",
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

  // Fire onSuccess once when the user becomes authenticated while the modal is open.
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

  // Auto-submit the four-digit code once (no resubmit loop on a wrong code).
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
      <Dialog open={open} onClose={() => !isSubmitting && close()} maxWidth="xs" fullWidth
        slotProps={{ paper: { sx: { borderRadius: 5, overflow: "hidden", boxShadow: "0 28px 80px -40px rgba(31,70,53,.65)" } } }}>
        <Box sx={{ height: 4, bgcolor: "primary.main" }} />
        <DialogContent sx={{ p: { xs: 2.5, sm: 3 } }}>
          <IconButton size="small" onClick={close} disabled={isSubmitting}
            sx={{ position: "absolute", insetInlineEnd: 8, top: 8 }} aria-label="بستن">
            <CloseRoundedIcon fontSize="small" />
          </IconButton>

          <Stack spacing={2.5}>
            <Stack spacing={1} alignItems="center" textAlign="center">
              <Box sx={{ width: 52, height: 52, borderRadius: 3, display: "grid", placeItems: "center",
                bgcolor: "primary.50", border: "1px solid", borderColor: "primary.100" }}>
                <LockRoundedIcon color="primary" />
              </Box>
              <Typography variant="h6" fontWeight={800}>
                {isCodeStep ? "کد تأیید" : "ورود / ثبت‌نام"}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {isCodeStep
                  ? <>کد {OTP_LENGTH} رقمی ارسال‌شده به <Box component="span" dir="ltr" sx={{ fontWeight: 700 }}>{phone}</Box> را وارد کنید.</>
                  : "برای ادامه، شماره موبایل خود را وارد کنید."}
              </Typography>
            </Stack>

            {error && <Alert severity="error" sx={{ borderRadius: 2 }}>{error}</Alert>}

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
                    placeholder="مثال: 09031234567"
                    disabled={isSubmitting}
                    inputProps={{ inputMode: "numeric", dir: "ltr", style: { direction: "ltr", textAlign: "left", letterSpacing: 1, unicodeBidi: "plaintext" } }}
                  />
                  <Button type="submit" variant="contained" size="large" disabled={isSubmitting || !phone.trim()}
                    sx={{ borderRadius: 99, py: 1.3, fontWeight: 700 }}>
                    {isSubmitting ? <CircularProgress size={22} color="inherit" /> : "ارسال کد تأیید"}
                  </Button>
                </Stack>
              </Box>
            ) : (
              <Stack spacing={2}>
                <OtpBoxes value={code} onChange={setCode} disabled={isSubmitting} />
                <Button variant="contained" size="large" onClick={() => verifyCode(code)}
                  disabled={isSubmitting || !OTP_PATTERN.test(code)}
                  sx={{ borderRadius: 99, py: 1.3, fontWeight: 700 }}>
                  {isSubmitting ? <CircularProgress size={22} color="inherit" /> : "تأیید و ورود"}
                </Button>
                <Button size="small" color="inherit" onClick={() => { setCode(""); reset(); }} disabled={isSubmitting}>
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
