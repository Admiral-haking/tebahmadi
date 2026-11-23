import type { BajetPayEnv } from './paymentConfig';

export type BajetPayCreateOrderInput = {
  orderId: string;
  amountRial: number;
  returnUrl: string;
  mobile: string;
};

export type BajetPayCreateOrderOutput = {
  referenceId: string;
  redirectUrl: string;
  raw: unknown;
};

export type BajetPayVerifyOutput = {
  ok: boolean;
  referenceId?: string;
  code: number;
  message?: string;
  raw: unknown;
};

type BajetPayResponse = {
  success?: boolean;
  message?: string;
  result?: {
    token?: string;
    referenceId?: string;
    referUrl?: string;
    status?: string | number;
    creditAmount?: number;
    cashAmount?: number;
  };
};

type BajetPayCallbackInput = {
  invoiceId?: unknown;
  tx?: unknown;
  transactionId?: unknown;
  body?: Record<string, unknown>;
  query?: Record<string, unknown>;
};

export type BajetPayCallback = {
  invoiceId: string;
  transactionId: string;
  referenceId?: string;
  state?: string;
  amountRial?: number;
};

function pickSingle(value: unknown): string | undefined {
  if (Array.isArray(value)) return pickSingle(value[0]);
  if (value === null || value === undefined) return undefined;
  const normalized = String(value).trim();
  return normalized || undefined;
}

export function normalizeBajetPayCallback(input: BajetPayCallbackInput): BajetPayCallback | null {
  const body = input.body ?? {};
  const query = input.query ?? {};
  const invoiceId = pickSingle(input.invoiceId ?? query.invoiceId ?? body.invoiceId ?? body.orderId);
  const transactionId = pickSingle(
    input.tx ?? input.transactionId ?? query.tx ?? query.transactionId ?? body.tx ?? body.transactionId,
  );
  if (!invoiceId || !transactionId) return null;

  const referenceId = pickSingle(
    query.referenceId ?? query.refId ?? body.referenceId ?? body.refId ?? body.authority,
  );
  const state = pickSingle(query.state ?? query.status ?? body.state ?? body.status ?? body.result);
  const amountRaw = pickSingle(query.amount ?? body.amount ?? body.amountRial);
  const amountValue = amountRaw ? Number(amountRaw) : NaN;

  return {
    invoiceId,
    transactionId,
    ...(referenceId ? { referenceId } : {}),
    ...(state ? { state } : {}),
    ...(Number.isSafeInteger(amountValue) && amountValue >= 0 ? { amountRial: amountValue } : {}),
  };
}

function trimBaseUrl(value: string) {
  return value.replace(/\/+$/, '');
}

async function parseJson<T>(response: Response): Promise<T> {
  const body = await response.text();
  try {
    return body ? (JSON.parse(body) as T) : ({} as T);
  } catch (cause) {
    throw Object.assign(new Error('bajetpay_invalid_json'), { cause, body });
  }
}

async function postJson<T>(url: string, body: unknown, token?: string): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const payload = await parseJson<T>(response);
    if (!response.ok) {
      throw Object.assign(new Error(`bajetpay_http_${response.status}`), {
        status: response.status,
        payload,
      });
    }
    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

class BajetPayClient {
  private readonly baseUrl: string;
  private readonly terminalId: string;
  private readonly username: string;
  private readonly password: string;
  private token?: string;
  private tokenExpiresAt = 0;
  private tokenRequest?: Promise<string>;

  constructor(env: BajetPayEnv) {
    this.baseUrl = trimBaseUrl(env.baseUrl);
    this.terminalId = env.terminalId;
    this.username = env.username;
    this.password = env.password;
  }

  private async requestToken(): Promise<string> {
    const payload = await postJson<BajetPayResponse>(`${this.baseUrl}/token`, {
      username: this.username,
      password: this.password,
      terminalId: this.terminalId,
    });
    const token = payload.result?.token;
    if (!payload.success || !token) throw new Error(payload.message || 'bajetpay_token_failed');
    this.token = token;
    this.tokenExpiresAt = Date.now() + 14 * 60_000;
    return token;
  }

  private async getToken(force = false): Promise<string> {
    if (!force && this.token && this.tokenExpiresAt > Date.now()) return this.token;
    if (!force && this.tokenRequest) return this.tokenRequest;
    this.tokenRequest = this.requestToken();
    try {
      return await this.tokenRequest;
    } finally {
      this.tokenRequest = undefined;
    }
  }

  private async authorizedPost<T>(path: string, body: unknown): Promise<T> {
    const token = await this.getToken();
    try {
      return await postJson<T>(`${this.baseUrl}/${path}`, body, token);
    } catch (error) {
      if ((error as { status?: number }).status !== 401) throw error;
      return postJson<T>(`${this.baseUrl}/${path}`, body, await this.getToken(true));
    }
  }

  async createOrder(input: BajetPayCreateOrderInput): Promise<BajetPayCreateOrderOutput> {
    const payload = await this.authorizedPost<BajetPayResponse>('order', {
      orderId: input.orderId,
      amount: Math.max(0, Math.floor(input.amountRial)),
      returnUrl: input.returnUrl,
      mobile: input.mobile,
    });
    const referenceId = payload.result?.referenceId;
    const redirectUrl = payload.result?.referUrl;
    if (!payload.success || !referenceId || !redirectUrl) {
      throw new Error(payload.message || 'bajetpay_order_failed');
    }
    return { referenceId, redirectUrl, raw: payload };
  }

  async verify(referenceId: string): Promise<BajetPayVerifyOutput> {
    try {
      const payload = await this.authorizedPost<BajetPayResponse>('verify', { referenceId });
      const status = String(payload.result?.status ?? '').toLowerCase();
      const hasAmount =
        Number(payload.result?.creditAmount ?? 0) > 0 || Number(payload.result?.cashAmount ?? 0) > 0;
      const ok = Boolean(payload.success) &&
        (!status || ['success', 'successful', 'completed'].includes(status) || hasAmount);
      return {
        ok,
        referenceId: payload.result?.referenceId ?? referenceId,
        code: ok ? 100 : 0,
        message: payload.message,
        raw: payload,
      };
    } catch (error) {
      const typed = error as { status?: number; payload?: unknown };
      return {
        ok: false,
        code: typed.status ?? -1,
        message: error instanceof Error ? error.message : 'bajetpay_verify_failed',
        raw: typed.payload ?? { error: String(error) },
      };
    }
  }
}

const clientCache = new Map<string, BajetPayClient>();

export function getBajetPayClient(env: BajetPayEnv) {
  const key = `${env.baseUrl}:${env.terminalId}:${env.username}`;
  let client = clientCache.get(key);
  if (!client) {
    client = new BajetPayClient(env);
    clientCache.set(key, client);
  }
  return client;
}
