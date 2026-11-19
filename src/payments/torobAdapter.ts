type TorobError = {
  code?: number;
  message?: string;
  user_message?: string;
  data?: unknown;
};

type TorobEnvelope<T> =
  | { successful: true; response: T }
  | { successful: false; error?: TorobError };

export type TorobEnv = {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  username: string;
  password: string;
};

export type TorobEligibility = {
  eligible: boolean;
  message_title?: string;
  description?: string;
};

export type TorobPaymentRequestInput = {
  amountRial: number;
  discountAmountRial?: number;
  externalSourceAmountRial?: number;
  mobile?: string;
  returnURL: string;
  transactionId: string;
  cartList: unknown;
};

export type TorobPaymentRequestOutput = {
  paymentToken: string;
  paymentPageUrl: string;
};

export type TorobPaymentVerifyOutput = {
  ok: boolean;
  transactionId?: string;
  code?: number;
  raw: unknown;
};

export type TorobPaymentSettleOutput = {
  ok: boolean;
  code?: number;
  raw: unknown;
};

function trimTrailingSlash(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

async function parseJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  try {
    return text ? (JSON.parse(text) as T) : ({} as T);
  } catch (error) {
    throw Object.assign(new Error('Failed to parse TorobPay response'), { cause: error, body: text });
  }
}

function unwrap<T>(payload: unknown): T {
  const envelope = payload as { successful?: boolean; response?: T; error?: TorobError };
  if (typeof envelope?.successful === 'boolean') {
    if (envelope.successful) {
      return envelope.response as T;
    }
    const err = envelope.error;
    const code = err?.code;
    const message = err?.user_message || err?.message || 'torob_request_failed';
    throw Object.assign(new Error(message), { code, error: err, payload });
  }

  // OAuth token endpoint may return plain JSON instead of envelope.
  return payload as T;
}

class TorobClient {
  private readonly env: TorobEnv;
  private readonly baseUrl: string;
  private readonly basicAuth: string;
  private tokenCache?: { token: string; expiresAt: number };

  constructor(env: TorobEnv) {
    this.env = env;
    this.baseUrl = trimTrailingSlash(env.baseUrl);
    this.basicAuth = `Basic ${Buffer.from(`${env.clientId}:${env.clientSecret}`).toString('base64')}`;
  }

  private async fetchTorob<T>(path: string, init: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, init);

    const payload = await parseJson<unknown>(response);

    if (!response.ok) {
      const err = (payload as { error?: TorobError })?.error;
      throw Object.assign(new Error(err?.user_message || err?.message || `TorobPay HTTP ${response.status}`), {
        status: response.status,
        code: err?.code,
        payload,
      });
    }

    return unwrap(payload);
  }

  private async getAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.tokenCache && now < this.tokenCache.expiresAt - 30_000) {
      return this.tokenCache.token;
    }

    const payload = await this.fetchTorob<{ access_token: string }>('/api/online/v1/oauth/token', {
      method: 'POST',
      headers: {
        Authorization: this.basicAuth,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: this.env.username,
        password: this.env.password,
      }),
    });

    const token = payload.access_token;
    if (!token) {
      throw new Error('torob_missing_access_token');
    }

    this.tokenCache = {
      token,
      expiresAt: now + 55 * 60 * 1000,
    };

    return token;
  }

  private async authorizedHeaders(): Promise<HeadersInit> {
    const token = await this.getAccessToken();
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  async checkEligibility(amountRial: number): Promise<TorobEligibility> {
    const headers = await this.authorizedHeaders();
    const search = new URLSearchParams({ amount: String(Math.floor(amountRial)) });
    return this.fetchTorob<TorobEligibility>(`/api/online/offer/v1/eligible?${search.toString()}`, {
      method: 'GET',
      headers,
    });
  }

  async requestPayment(input: TorobPaymentRequestInput): Promise<TorobPaymentRequestOutput> {
    const headers = await this.authorizedHeaders();
    return this.fetchTorob<TorobPaymentRequestOutput>('/api/online/payment/v1/token', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        amount: input.amountRial,
        discountAmount: input.discountAmountRial,
        externalSourceAmount: input.externalSourceAmountRial,
        mobile: input.mobile,
        paymentMethodTypeDto: 'ONLINE_CREDIT',
        returnURL: input.returnURL,
        transactionId: input.transactionId,
        cartList: input.cartList,
      }),
    });
  }

  async verifyPayment(paymentToken: string): Promise<TorobPaymentVerifyOutput> {
    const headers = await this.authorizedHeaders();
    const response = await this.fetchTorob<{ transactionId?: string }>(
      '/api/online/payment/v1/verify',
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ paymentToken }),
      }
    );

    return { ok: true, transactionId: response.transactionId, raw: response };
  }

  async settlePayment(paymentToken: string): Promise<TorobPaymentSettleOutput> {
    const headers = await this.authorizedHeaders();
    const response = await this.fetchTorob<Record<string, unknown>>(
      '/api/online/payment/v1/settle',
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ paymentToken }),
      }
    );

    return { ok: true, raw: response };
  }
}

const clientCache = new Map<string, TorobClient>();

export function getTorobClient(env: TorobEnv): TorobClient {
  const cacheKey = `${env.baseUrl}:${env.clientId}`;
  let client = clientCache.get(cacheKey);
  if (!client) {
    client = new TorobClient(env);
    clientCache.set(cacheKey, client);
  }
  return client;
}
