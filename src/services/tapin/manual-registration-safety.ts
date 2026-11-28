import { TapinError } from './client';

/**
 * A register request may have reached Tapin even when the caller received an
 * upstream failure. Such failures must be reconciled by manual_id, never
 * retried blindly.
 */
export function isAmbiguousTapinRegistrationFailure(error: unknown): boolean {
  if (!(error instanceof TapinError)) return true;
  return error.status >= 500 || error.status === 409;
}

export function safeTapinErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : 'خطای نامشخص در ارتباط با تاپین.';
  return message.trim().slice(0, 300) || 'خطای نامشخص در ارتباط با تاپین.';
}
