export const CHECKOUT_ATTEMPT_KEY_MAX_LENGTH = 128;
export const CHECKOUT_ATTEMPT_STORAGE_KEY = 'tebahmadi.checkout.attempt-key';

export function normalizeCheckoutAttemptKey(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().slice(0, CHECKOUT_ATTEMPT_KEY_MAX_LENGTH);
  return normalized || null;
}

export function createCheckoutAttemptKey(input?: { now?: number; random?: string }): string {
  const now = Number.isFinite(input?.now) ? Math.max(0, Math.floor(input!.now!)) : Date.now();
  const random = (input?.random?.trim() || `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`)
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 48) || 'retry';
  return normalizeCheckoutAttemptKey(`tebahmadi-${now}-${random}`) ?? `tebahmadi-${now}`;
}

export function shouldReuseCheckoutAttempt(value: unknown): boolean {
  return normalizeCheckoutAttemptKey(value) !== null;
}

export function getOrCreateCheckoutAttemptKey(
  current: unknown,
  input?: { now?: number; random?: string },
): string {
  return normalizeCheckoutAttemptKey(current) ?? createCheckoutAttemptKey(input);
}
