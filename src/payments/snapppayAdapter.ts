type SnappPayError = {
  errorCode?: number;
  message?: string;
  data?: unknown;
};

type SnappPayEnvelope<T> =
  | { successful: true; response: T }
  | { successful: false; errorData?: SnappPayError };

export type SnappPayEnv = {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  username: string;
  password: string;
  venture?: string;
};

export type SnappPayEligibility = {
  eligible: boolean;
  title?: string;
  title_message?: string;
  titleMessage?: string;
  description?: string;
};

export type SnappPayPaymentRequestInput = {
  amountRial: number;
  discountAmountRial?: number;
  externalSourceAmountRial?: number;
  mobile: string;
  returnURL: string;
  transactionId: string | number;
  cartList: unknown;
  forcedPaymentMethodTypes?: string[];
};

export type SnappPayPaymentRequestOutput = {
  paymentToken: string;
  paymentPageUrl: string;
  raw: unknown;
};

export type SnappPayPaymentVerifyOutput = {
  ok: boolean;
  transactionId?: string;
  code?: number;
  raw: unknown;
};

export type SnappPayPaymentSettleOutput = {
  ok: boolean;
  transactionId?: string;
  code?: number;
  raw: unknown;
};

export type SnappPayPaymentMutationOutput = {
  ok: boolean;
  transactionId?: string;
  code?: number;
  raw: unknown;
};

export type SnappPayPaymentStatusOutput = {
  ok: boolean;
  transactionId?: string;
  status?: string;
  amount?: number;
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
    return { text } as T
  }
}

function unwrap<T>(payload: unknown): T {
  const envelope = payload as SnappPayEnvelope<T>;
  if (typeof envelope?.successful === 'boolean') {
    if (envelope.successful) {
      return envelope.response;
    }
    const err = envelope.errorData;
    const code = err?.errorCode;
    const message = err?.message || 'snapppay_request_failed';
    throw Object.assign(new Error(message), { code, error: err, payload });
  }

  return payload as T;
}

class SnappPayClient {
  private readonly env: SnappPayEnv;
  private readonly baseUrl: string;
  private readonly basicAuth: string;
  private tokenCache?: { token: string; expiresAt: number };

  constructor(env: SnappPayEnv) {
    this.env = env;
    this.baseUrl = trimTrailingSlash(env.baseUrl);
    this.basicAuth = `Basic ${Buffer.from(`${env.clientId}:${env.clientSecret}`).toString('base64')}`;
  }

  private async fetchSnappPay<T>(path: string, init: RequestInit, timeoutMs: number = 25000): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const signal = controller.signal;

    try {
      const response = await fetch(`${this.baseUrl}${path}`, { ...init, signal });
      const payload = await parseJson<unknown>(response);

      if (!response.ok) {
        const directErr = payload as SnappPayError;
        const err = (payload as { errorData?: SnappPayError })?.errorData ?? directErr;
        const message = err?.message || `snapppay_http_${response.status}`;
        throw Object.assign(new Error(message), { code: err?.errorCode, error: err, payload });
       }
        
      return unwrap<T>(payload);
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async getAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.tokenCache && now < this.tokenCache.expiresAt - 30_000) {
      return this.tokenCache.token;
    }

    const formData = new URLSearchParams();
    formData.append('grant_type', 'password');
    formData.append('scope', 'online-merchant');
    formData.append('username', this.env.username);
    formData.append('password', this.env.password);

    const payload = await this.fetchSnappPay<{ access_token: string; expires_in?: number }>(
      '/api/online/v1/oauth/token',
      {
        method: 'POST',
        headers: {
          Authorization: this.basicAuth,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
      },
    );

    const token = payload.access_token;
    if (!token) {
      throw new Error('snapppay_missing_access_token');
    }

    const ttlSeconds = typeof payload.expires_in === 'number' ? payload.expires_in : 3600;
    this.tokenCache = {
      token,
      expiresAt: now + Math.max(60, ttlSeconds - 300) * 1000,
    };

    return token;
  }

  private async authorizedHeaders(): Promise<HeadersInit> {
    const token = await this.getAccessToken();
    return {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(this.env.venture ? { venture: this.env.venture } : {}),
    };
  }

  async checkEligibility(
    amountRial: number,
    paymentMethodTypes?: string[],
  ): Promise<SnappPayEligibility> {
    const headers = await this.authorizedHeaders();
    const search = new URLSearchParams({ amount: String(Math.floor(amountRial)) });
    if (paymentMethodTypes?.length) {
      search.set('paymentMethodTypes', paymentMethodTypes.join(','));
    }

    return this.fetchSnappPay<SnappPayEligibility>(
      `/api/online/offer/v1/eligible?${search.toString()}`,
      {
        method: 'GET',
        headers,
      },
    );
  }

  async requestPayment(
    input: SnappPayPaymentRequestInput,
  ): Promise<SnappPayPaymentRequestOutput> {
    const headers = await this.authorizedHeaders();
    const body: Record<string, unknown> = {
      amount: input.amountRial,
      cartList: input.cartList,
      discountAmount: input.discountAmountRial ?? 0,
      externalSourceAmount: input.externalSourceAmountRial ?? 0,
      mobile: input.mobile,
      returnURL: input.returnURL,
      transactionId: input.transactionId,
    };

    if (input.forcedPaymentMethodTypes?.length) {
      body.forcedPaymentMethodTypes = input.forcedPaymentMethodTypes;
    }

    const response = await this.fetchSnappPay<{
      paymentToken?: string;
      paymentPageUrl?: string;
    }>(
      '/api/online/payment/v1/token',
      {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      },
    );

    if (!response.paymentToken || !response.paymentPageUrl) {
      throw Object.assign(new Error('SnappPay response missing paymentToken or paymentPageUrl'), {
        response,
      });
    }

    return {
      paymentToken: response.paymentToken,
      paymentPageUrl: response.paymentPageUrl,
      raw: response,
    };
  }

  async verifyPayment(paymentToken: string): Promise<SnappPayPaymentVerifyOutput> {
    try {
      const headers = await this.authorizedHeaders();
      const response = await this.fetchSnappPay<{ transactionId?: string }>(
        '/api/online/payment/v1/verify',
        {
          method: 'POST',
          headers,
          body: JSON.stringify({ paymentToken }),
        },
      );

      return { ok: true, transactionId: response.transactionId, raw: response };
    } catch (error) {
      const err = error as { code?: number };
      return {
        ok: false,
        code: err.code,
        raw: { error: error instanceof Error ? error.message : String(error) },
      };
    }
  }

  async settlePayment(paymentToken: string): Promise<SnappPayPaymentSettleOutput> {
    try {
      const headers = await this.authorizedHeaders();
      const response = await this.fetchSnappPay<{ transactionId?: string }>(
        '/api/online/payment/v1/settle',
        {
          method: 'POST',
          headers,
          body: JSON.stringify({ paymentToken }),
        },
      );

      return { ok: true, transactionId: response.transactionId, raw: response };
    } catch (error) {
      const err = error as { code?: number };
      return {
        ok: false,
        code: err.code,
        raw: { error: error instanceof Error ? error.message : String(error) },
      };
    }
  }

  async updatePayment(input: {
    paymentToken: string;
    amountRial: number;
    discountAmountRial?: number;
    externalSourceAmountRial?: number;
    cartList: unknown;
  }): Promise<SnappPayPaymentMutationOutput> {
    try {
      const headers = await this.authorizedHeaders();
      const response = await this.fetchSnappPay<{ transactionId?: string }>(
        '/api/online/payment/v1/update',
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            amount: input.amountRial,
            cartList: input.cartList,
            discountAmount: input.discountAmountRial ?? 0,
            externalSourceAmount: input.externalSourceAmountRial ?? 0,
            paymentToken: input.paymentToken,
          }),
        },
      );

      return { ok: true, transactionId: response.transactionId, raw: response };
    } catch (error) {
      const err = error as { code?: number };
      return {
        ok: false,
        code: err.code,
        raw: { error: error instanceof Error ? error.message : String(error) },
      };
    }
  }

  async cancelPayment(paymentToken: string): Promise<SnappPayPaymentMutationOutput> {
    try {
      const headers = await this.authorizedHeaders();
      const response = await this.fetchSnappPay<{ transactionId?: string }>(
        '/api/online/payment/v1/cancel',
        {
          method: 'POST',
          headers,
          body: JSON.stringify({ paymentToken }),
        },
      );

      return { ok: true, transactionId: response.transactionId, raw: response };
    } catch (error) {
      const err = error as { code?: number };
      return {
        ok: false,
        code: err.code,
        raw: { error: error instanceof Error ? error.message : String(error) },
      };
    }
  }

  async getPaymentStatus(paymentToken: string): Promise<SnappPayPaymentStatusOutput> {
    try {
      const headers = await this.authorizedHeaders();
      const search = new URLSearchParams({ paymentToken });
      const response = await this.fetchSnappPay<{
        transactionId?: string;
        status?: string;
        amount?: number;
      }>(`/api/online/payment/v1/status?${search.toString()}`, {
        method: 'GET',
        headers,
      });

      return {
        ok: true,
        transactionId: response.transactionId,
        status: response.status,
        amount: response.amount,
        raw: response,
      };
    } catch (error) {
      const err = error as { code?: number };
      return {
        ok: false,
        code: err.code,
        raw: { error: error instanceof Error ? error.message : String(error) },
      };
    }
  }
}

const clientCache = new Map<string, SnappPayClient>();

export function getSnappPayClient(env: SnappPayEnv): SnappPayClient {
  const cacheKey = `${env.baseUrl}:${env.clientId}:${env.username}`;
  let client = clientCache.get(cacheKey);
  if (!client) {
    client = new SnappPayClient(env);
    clientCache.set(cacheKey, client);
  }
  return client;
}
