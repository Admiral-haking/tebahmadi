import { Types } from 'mongoose';

export function normalizeCallbackPath(pathname?: string): string {
  if (!pathname || pathname.trim().length === 0) {
    return '/payments/verify';
  }

  if (!pathname.startsWith('/')) {
    return `/${pathname}`;
  }

  return pathname;
}

export function buildCallbackUrl(baseUrl: string, path: string, invoiceId: Types.ObjectId | string, transactionId: Types.ObjectId | string) {
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const url = new URL(path, `${normalizedBase}/`);
  url.searchParams.set('invoiceId', invoiceId.toString());
  url.searchParams.set('tx', transactionId.toString());
  return url.toString();
}

export function ensureAppBaseUrl(value: string | undefined): string {
  if (!value) {
    throw new Error('APP_BASE_URL is not configured');
  }
  return value;
}
