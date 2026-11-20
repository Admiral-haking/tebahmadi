'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { useAuth } from './auth-context';
import type { AuthUser, LoginContextValue, LoginStep } from './types';

interface VerifyResponse {
  ok: boolean;
  user: AuthUser;
}

interface RequestCodeResponse {
  ok: boolean;
  manual?: boolean;
}

const LoginContext = createContext<LoginContextValue | undefined>(undefined);

const GENERIC_REQUEST_ERROR = 'ارسال کد با مشکل مواجه شد. لطفاً دوباره تلاش کنید.';
const GENERIC_VERIFY_ERROR = 'تایید کد با مشکل مواجه شد. لطفاً دوباره تلاش کنید.';
const GENERIC_PROVIDER_ERROR = 'فعلاً امکان ورود نیست؛ لطفاً بعداً دوباره تلاش کنید.';

function cleanServerMessage(raw: string | null | undefined): string | null {
  if (!raw) {
    return null;
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed) as { error?: unknown; message?: unknown };
      const candidate = [parsed.error, parsed.message].find((value) => typeof value === 'string');
      if (typeof candidate === 'string') {
        return candidate;
      }
    } catch {
      // ignore JSON parse errors and fall through to returning the trimmed string
    }
  }
  if (trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html')) {
    return null;
  }
  return trimmed;
}

export function translateError(raw: string | null | undefined, fallback: string): string {
  const message = cleanServerMessage(raw);
  if (!message) {
    return fallback;
  }
  const lower = message.toLowerCase();

  if (lower.includes('invalid phone number')) {
    return 'شماره موبایل نامعتبر است. لطفاً شماره را با فرمت صحیح وارد کنید.';
  }
  if (lower.includes('code already requested')) {
    return 'کد تایید قبلاً ارسال شده است. لطفاً کمی صبر کنید و دوباره تلاش کنید.';
  }
  if (lower.includes('verification code expired')) {
    return 'کد تایید منقضی شده است. لطفاً دوباره درخواست ارسال کد دهید.';
  }
  if (lower.includes('verification code not found')) {
    return 'کد تایید یافت نشد. لطفاً دوباره کد جدید دریافت کنید.';
  }
  if (lower.includes('invalid verification code')) {
    return 'کد تایید وارد شده صحیح نیست. دوباره تلاش کنید.';
  }
  if (lower.includes('too many invalid attempts')) {
    return 'تعداد تلاش‌های ناموفق زیاد است. بعد از چند دقیقه دوباره تلاش کنید.';
  }
  if (lower.startsWith('sms_provider_') || lower === 'login_unavailable') {
    return GENERIC_PROVIDER_ERROR;
  }

  return message;
}

/** Convert Persian/Arabic-Indic digits to ASCII so phone validation accepts a
 * number typed on a Persian keyboard (۰۹۱۲… / ٠٩١٢…). */
function toLatinDigits(input: string): string {
  return input
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
}

function normalizePhoneNumber(input: string): { phone?: string; error?: string } {
  const trimmed = toLatinDigits(input).trim();
  if (!trimmed) {
    return { error: 'شماره موبایل را وارد کنید.' };
  }

  let candidate = trimmed.replace(/\s+/g, '');
  candidate = candidate.replace(/^00/, '+');

  if (candidate.startsWith('+')) {
    const digits = candidate.slice(1);
    if (!/^\d+$/.test(digits)) {
      return { error: 'شماره موبایل فقط باید شامل اعداد باشد.' };
    }
    return { phone: `+${digits}` };
  }

  const digitsOnly = candidate.replace(/[^\d]/g, '');
  if (/^0098\d{10}$/.test(digitsOnly)) {
    return { phone: `+${digitsOnly.slice(2)}` };
  }
  if (/^98\d{10}$/.test(digitsOnly)) {
    return { phone: `+${digitsOnly}` };
  }
  if (/^09\d{9}$/.test(digitsOnly)) {
    return { phone: `+98${digitsOnly.slice(1)}` };
  }
  if (/^9\d{9}$/.test(digitsOnly)) {
    return { phone: `+98${digitsOnly}` };
  }

  return { error: 'فرمت شماره موبایل صحیح نیست. مثال: +989123456789' };
}

async function extractErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const text = await response.text();
    return translateError(text, fallback);
  } catch {
    return fallback;
  }
}

export function LoginProvider({ children }: ChildrenProps) {
  const auth = useAuth();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<LoginStep>('idle');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [manualCode, setManualCode] = useState(false);

  const reset = useCallback(() => {
    setPhone('');
    setCode('');
    setStep('idle');
    setError(null);
    setIsSubmitting(false);
    setManualCode(false);
  }, []);

  const requestCode = useCallback(async (inputPhone: string) => {
    const normalized = normalizePhoneNumber(inputPhone);
    if (normalized.error) {
      setError(normalized.error);
      setStep('idle');
      return;
    }
    const normalizedPhone = normalized.phone ?? '';

    setIsSubmitting(true);
    setError(null);
    setManualCode(false);
    setStep('requesting');
    try {
      const response = await fetch('/api/auth/request-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ phone: normalizedPhone }),
      });

      if (!response.ok) {
        const message = await extractErrorMessage(response, GENERIC_REQUEST_ERROR);
        throw new Error(message);
      }

      const data = (await response.json()) as RequestCodeResponse;
      if (!data.ok) {
        throw new Error(GENERIC_REQUEST_ERROR);
      }

      setPhone(normalizedPhone);
      setCode('');
      setManualCode(Boolean(data.manual));
      setStep('code-sent');
    } catch (err) {
      if (err instanceof Error) {
        setError(translateError(err.message, GENERIC_REQUEST_ERROR));
      } else {
        setError(GENERIC_REQUEST_ERROR);
      }
      setStep('idle');
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  const verifyCode = useCallback(
    async (inputCode: string) => {
      const normalizedCode = inputCode.trim();
      if (!phone) {
        setError('ابتدا شماره موبایل خود را وارد کنید.');
        return;
      }
      if (!normalizedCode) {
        setError('کد تایید را وارد کنید.');
        return;
      }

      setIsSubmitting(true);
      setError(null);
      setStep('verifying');
      try {
        const response = await fetch('/api/auth/verify-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ phone, code: normalizedCode }),
        });

        if (!response.ok) {
          const message = await extractErrorMessage(response, GENERIC_VERIFY_ERROR);
          throw new Error(message);
        }

        const data = (await response.json()) as VerifyResponse;
        if (!data.ok || !data.user) {
          throw new Error(GENERIC_VERIFY_ERROR);
        }

        auth.setUser(data.user);
        setCode(normalizedCode);
        setStep('idle');
      } catch (err) {
        if (err instanceof Error) {
          setError(translateError(err.message, GENERIC_VERIFY_ERROR));
        } else {
          setError(GENERIC_VERIFY_ERROR);
        }
        setStep('code-sent');
      } finally {
        setIsSubmitting(false);
      }
    },
    [auth, phone],
  );

  const value = useMemo<LoginContextValue>(
    () => ({
      phone,
      code,
      step,
      error,
      isSubmitting,
      manualCode,
      requestCode,
      verifyCode,
      reset,
      setPhone,
      setCode,
    }),
    [phone, code, step, error, isSubmitting, manualCode, requestCode, verifyCode, reset],
  );

  return <LoginContext.Provider value={value}>{children}</LoginContext.Provider>;
}

export function useLogin(): LoginContextValue {
  const ctx = useContext(LoginContext);
  if (!ctx) {
    throw new Error('useLogin must be used within a LoginProvider');
  }
  return ctx;
}
