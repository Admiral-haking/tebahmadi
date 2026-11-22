import type { TapinEnvelope } from './types';
import { axiosRequest } from '@/utils/axios-request';

const DEFAULT_BASE_URL = 'https://api.tapin.ir/api/v2/public';

export class TapinError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly data?: unknown,
    public readonly tapinCode?: number,
  ) {
    super(message);
    this.name = 'TapinError';
  }
}

function logicalHttpStatus(code: number): number {
  if (code === 318) return 402;
  if ([332, 336, 401, 402].includes(code)) return 401;
  if ([337, 351, 403].includes(code)) return 403;
  if (
    [
      302, 303, 304, 305, 307, 309, 310, 312, 315, 320, 322, 324, 328, 342, 343, 344, 345, 346, 347,
      349, 352, 358, 362, 365, 367, 404,
    ].includes(code)
  )
    return 404;
  if ([306, 316, 341, 356, 363, 366, 368, 369, 370, 505, 600, 601].includes(code)) return 409;
  if ([301, 317, 321, 323, 327, 329, 330, 333, 350, 353, 354, 359, 364, -2, -1].includes(code))
    return 502;
  if (code === 1000) return 429;
  return 422;
}

export function getTapinConfig() {
  const token =
    process.env.TAPIN_WEBSERVICE_TOKEN?.trim() || process.env.TAPIN_TOKEN?.trim();
  const shopId = process.env.TAPIN_SHOP_ID?.trim();
  const baseUrl = (
    process.env.TAPIN_API_BASE_URL?.trim() || process.env.TAPIN_BASE_URL?.trim() || DEFAULT_BASE_URL
  ).replace(/\/+$/, '');
  if (!token || !shopId) {
    throw new TapinError('اتصال تاپین پیکربندی نشده است.', 503);
  }
  return { token, shopId, baseUrl };
}

function safePath(path: string): string {
  const clean = path.trim().replace(/^\/+/, '');
  if (!clean || clean.includes('..') || !/^[a-z0-9_\-/]+$/i.test(clean)) {
    throw new TapinError('مسیر وب‌سرویس تاپین معتبر نیست.', 400);
  }
  return clean.endsWith('/') ? clean : `${clean}/`;
}

function boundedEnvInt(name: string, fallback: number, min: number, max: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? Math.min(max, Math.max(min, Math.floor(value))) : fallback;
}

export function tapinRetryDelayMs(attempt: number, retryAfter?: string | null) {
  const seconds = Number(retryAfter);
  if (Number.isFinite(seconds) && seconds > 0) return Math.min(seconds * 1000, 10_000);
  if (retryAfter) {
    const dateDelay = Date.parse(retryAfter) - Date.now();
    if (Number.isFinite(dateDelay) && dateDelay > 0) return Math.min(dateDelay, 10_000);
  }
  return Math.min(400 * 2 ** Math.max(0, attempt - 1), 5_000);
}

export async function tapinRequest<T>(
  path: string,
  body?: unknown,
  options: {
    method?: 'GET' | 'POST';
    responseType?: 'json' | 'text' | 'raw';
    retrySafe?: boolean;
    timeoutMs?: number;
    retryAttempts?: number;
    includeShopId?: boolean;
  } = {},
): Promise<T> {
  const { token, shopId, baseUrl } = getTapinConfig();
  const method = options.method ?? 'POST';
  const includeShopId = options.includeShopId ?? true;
  const timeoutMs = options.timeoutMs ?? boundedEnvInt('TAPIN_TIMEOUT_MS', 20_000, 1_000, 60_000);
  const maxAttempts =
    options.retryAttempts ??
    (options.retrySafe ? boundedEnvInt('TAPIN_RETRY_ATTEMPTS', 3, 1, 5) : 1);
  const payload =
    body && typeof body === 'object' && !Array.isArray(body)
      ? (() => {
          const input = body as Record<string, unknown>;
          // Several callers pass an optional `shop_id`. Do not let an undefined
          // value erase the configured shop: the order-list endpoint rejects a
          // request without it with HTTP 422.
          return Object.fromEntries(
            Object.entries({
              ...(includeShopId ? { shop_id: input.shop_id ?? shopId } : {}),
              ...input,
            }).filter(([, value]) => value !== undefined),
          );
        })()
      : body;
  if (
    payload &&
    typeof payload === 'object' &&
    !Array.isArray(payload) &&
    includeShopId &&
    !('shop_id' in payload)
  ) {
    (payload as Record<string, unknown>).shop_id = shopId;
  }

  let response: Response | undefined;
  let lastNetworkError: unknown;
  const url = `${baseUrl}/${safePath(path)}`;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      response = await axiosRequest(url, {
        method,
        headers: {
          Authorization: token,
          Accept:
            options.responseType === 'json' || !options.responseType ? 'application/json' : '*/*',
          ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
        },
        body:
          method === 'POST'
            ? JSON.stringify(payload ?? (includeShopId ? { shop_id: shopId } : {}))
            : undefined,
        cache: 'no-store',
        signal: controller.signal,
      });
    } catch (error) {
      lastNetworkError = error;
      if (attempt === maxAttempts) break;
      await new Promise((resolve) => setTimeout(resolve, tapinRetryDelayMs(attempt)));
      continue;
    } finally {
      clearTimeout(timeout);
    }
    if (response.status !== 429 && response.status < 500) break;
    if (attempt < maxAttempts) {
      await new Promise((resolve) =>
        setTimeout(resolve, tapinRetryDelayMs(attempt, response?.headers.get('retry-after'))),
      );
    }
  }

  try {
    if (!response) {
      if (lastNetworkError instanceof Error && lastNetworkError.name === 'AbortError') {
        throw new TapinError('مهلت پاسخ‌گویی تاپین به پایان رسید.', 504);
      }
      throw new TapinError('ارتباط با وب‌سرویس تاپین ناموفق بود.', 502, lastNetworkError);
    }
    if (!response.ok) {
      const errorData = await response
        .clone()
        .text()
        .catch(() => '');
      throw new TapinError(`خطای ارتباط با تاپین (${response.status})`, response.status, errorData);
    }
    if (options.responseType === 'raw') return response as T;

    const contentType = response.headers.get('content-type') || '';
    const data = contentType.includes('json')
      ? await response.json().catch(() => null)
      : await response.text();
    if (options.responseType === 'text') return data as T;

    const envelope = data as TapinEnvelope<T> | null;
    const logicalStatus = envelope?.returns?.status;
    if (
      !envelope ||
      !('entries' in envelope) ||
      (logicalStatus !== undefined && (logicalStatus < 200 || logicalStatus >= 300))
    ) {
      throw new TapinError(
        envelope?.returns?.message || 'پاسخ نامعتبر از تاپین دریافت شد.',
        logicalStatus ? logicalHttpStatus(logicalStatus) : 502,
        data,
        logicalStatus,
      );
    }
    return envelope.entries;
  } catch (error) {
    if (error instanceof TapinError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new TapinError('مهلت پاسخ‌گویی تاپین به پایان رسید.', 504);
    }
    throw new TapinError('ارتباط با وب‌سرویس تاپین ناموفق بود.', 502, error);
  }
}
