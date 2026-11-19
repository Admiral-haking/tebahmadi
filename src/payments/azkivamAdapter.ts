import { createCipheriv } from 'crypto';

export type AzkivamEnv = {
  baseUrl: string;
  merchantId: string;
  username?: string;
  password?: string;
  apiKey?: string;
};

export type AzkivamTicketItem = {
  name: string;
  count: number;
  amount: number;
  url: string;
};

export type AzkivamCreateTicketInput = {
  amountRial: number;
  redirectUri: string;
  fallbackUri: string;
  providerId: number;
  mobileNumber: string;
  items: AzkivamTicketItem[];
};

export type AzkivamCreateTicketOutput = {
  ticketId: string;
  paymentUri: string;
  raw: unknown;
};

export type AzkivamVerifyTicketOutput = {
  ok: boolean;
  code: number;
  ticketId?: string;
  status?: number;
  raw: unknown;
};

type AzkivamEnvelope<T> = {
  rsCode?: number;
  message?: string;
  result?: T;
};

type AzkivamAuthResult = {
  accessToken?: string;
  access_token?: string;
  expiresIn?: number | string;
  expires_in?: number | string;
  expireIn?: number | string;
};

type AzkivamPurchaseResult = {
  payment_uri?: string;
  ticket_id?: string;
};

type AzkivamVerifyResult = {
  rsCode?: number;
  ticket_id?: string;
  status?: number;
};

function trimTrailingSlash(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

function normalizePath(path: string): string {
  return path.startsWith('/') ? path : `/${path}`;
}

async function parseJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  try {
    return text ? (JSON.parse(text) as T) : ({} as T);
  } catch (error) {
    throw Object.assign(new Error('Failed to parse Azkivam response'), {
      cause: error,
      body: text,
    });
  }
}

function readNumericTtl(value: number | string | undefined): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return undefined;
}

class AzkivamClient {
  private readonly baseUrl: string;
  private readonly merchantId: string;
  private readonly username?: string;
  private readonly password?: string;
  private readonly apiKey?: string;
  private accessToken?: string;
  private accessTokenExpiresAt = 0;
  private authenticatePromise?: Promise<string>;

  constructor(env: AzkivamEnv) {
    this.baseUrl = trimTrailingSlash(env.baseUrl);
    this.merchantId = env.merchantId;
    this.username = env.username;
    this.password = env.password;
    this.apiKey = env.apiKey;
  }

  private buildBasicAuthorization() {
    if (!this.username || !this.password) {
      return undefined;
    }

    return `Basic ${Buffer.from(`${this.username}:${this.password}`).toString('base64')}`;
  }

  private buildSignature(path: string, method: string) {
    if (!this.apiKey) {
      return undefined;
    }

    const keyBytes = Buffer.from(this.apiKey, 'hex');
    if (![16, 24, 32].includes(keyBytes.length)) {
      throw new Error('AZKIVAM_API_KEY must be a 16, 24, or 32 byte hex string');
    }

    const plainSignature = `${normalizePath(path)}##${method.toUpperCase()}#${this.apiKey}`;
    const cipher = createCipheriv(`aes-${keyBytes.length * 8}-cbc`, keyBytes, Buffer.alloc(16));
    return Buffer.concat([
      cipher.update(Buffer.from(plainSignature, 'utf8')),
      cipher.final(),
    ]).toString('hex');
  }

  private clearAccessToken() {
    this.accessToken = undefined;
    this.accessTokenExpiresAt = 0;
  }

  private isAccessTokenValid() {
    return (
      typeof this.accessToken === 'string' &&
      this.accessToken.length > 0 &&
      this.accessTokenExpiresAt > Date.now()
    );
  }

  private async authenticate(forceRefresh = false): Promise<string> {
    if (!forceRefresh && this.isAccessTokenValid()) {
      return this.accessToken!;
    }

    if (!forceRefresh && this.authenticatePromise) {
      return this.authenticatePromise;
    }

    this.clearAccessToken();
    this.authenticatePromise = this.requestAccessToken();

    try {
      return await this.authenticatePromise;
    } finally {
      this.authenticatePromise = undefined;
    }
  }

  private async requestAccessToken(): Promise<string> {
    if (!this.username || !this.password) {
      throw new Error('AZKIVAM username/password are not configured');
    }

    const response = await fetch(`${this.baseUrl}/auth/authenticate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: this.username,
        password: this.password,
      }),
    });

    const payload = await parseJson<AzkivamEnvelope<AzkivamAuthResult>>(response);
    if (!response.ok) {
      throw Object.assign(
        new Error(payload.message || `Azkivam auth failed with HTTP ${response.status}`),
        {
          status: response.status,
          code: payload.rsCode,
          payload,
        },
      );
    }

    if (typeof payload.rsCode === 'number' && payload.rsCode !== 0) {
      throw Object.assign(
        new Error(payload.message || `Azkivam auth failed with code ${payload.rsCode}`),
        {
          code: payload.rsCode,
          payload,
        },
      );
    }

    const accessToken = payload.result?.accessToken ?? payload.result?.access_token;
    if (!accessToken) {
      throw Object.assign(new Error('Azkivam auth response missing access token'), { payload });
    }

    const ttlSeconds =
      readNumericTtl(payload.result?.expiresIn) ??
      readNumericTtl(payload.result?.expires_in) ??
      readNumericTtl(payload.result?.expireIn) ??
      7200;
    const refreshSkewSeconds = 300;
    const effectiveTtlSeconds = Math.max(60, ttlSeconds - refreshSkewSeconds);

    this.accessToken = accessToken;
    this.accessTokenExpiresAt = Date.now() + effectiveTtlSeconds * 1000;

    return accessToken;
  }

  private async postAuthorized<T>(
    path: string,
    body: unknown,
    allowRetry = true,
  ): Promise<AzkivamEnvelope<T>> {
    const normalizedPath = normalizePath(path);
    const bodyText = JSON.stringify(body);
    const headers: Record<string, string> = {
      Accept: 'application/json',
      MerchantId: this.merchantId,
    };

    if (this.username && this.password) {
      const accessToken = await this.authenticate();
      headers.Authorization = `Bearer ${accessToken}`;
      headers['Content-Type'] = 'application/json';
    } else {
      const signature = this.buildSignature(normalizedPath, 'POST');
      if (!signature) {
        throw new Error('AZKIVAM credentials are not configured');
      }
      headers.Signature = signature;
      headers['Content-Type'] = 'text/plain';
      const basicAuthorization = this.buildBasicAuthorization();
      if (basicAuthorization) {
        headers.Authorization = basicAuthorization;
      }
    }

    const response = await fetch(`${this.baseUrl}${normalizedPath}`, {
      method: 'POST',
      headers,
      body: bodyText,
    });

    if (response.status === 401 && this.username && this.password && allowRetry) {
      this.clearAccessToken();
      await this.authenticate(true);
      return this.postAuthorized(path, body, false);
    }

    const payload = await parseJson<AzkivamEnvelope<T>>(response);
    if (!response.ok) {
      throw Object.assign(
        new Error(payload.message || `Azkivam request failed with HTTP ${response.status}`),
        {
          status: response.status,
          code: payload.rsCode,
          payload,
        },
      );
    }

    return payload;
  }

  async createTicket(input: AzkivamCreateTicketInput): Promise<AzkivamCreateTicketOutput> {
    const payload = await this.postAuthorized<AzkivamPurchaseResult>('/payment/purchase', {
      amount: input.amountRial,
      redirect_uri: input.redirectUri,
      fallback_uri: input.fallbackUri,
      provider_id: input.providerId,
      mobile_number: input.mobileNumber,
      merchant_id: this.merchantId,
      items: input.items,
    });

    if (payload.rsCode !== 0) {
      throw Object.assign(
        new Error(payload.message || `Azkivam request failed with code ${payload.rsCode ?? 'unknown'}`),
        {
          code: payload.rsCode,
          payload,
        },
      );
    }

    const ticketId = payload.result?.ticket_id;
    const paymentUri = payload.result?.payment_uri;
    if (!ticketId || !paymentUri) {
      throw Object.assign(new Error('Azkivam response missing ticket_id or payment_uri'), { payload });
    }

    return {
      ticketId,
      paymentUri,
      raw: payload,
    };
  }

  async verifyTicket(ticketId: string): Promise<AzkivamVerifyTicketOutput> {
    const payload = await this.postAuthorized<AzkivamVerifyResult>('/payment/verify', {
      ticket_id: ticketId,
    });

    const topLevelCode = typeof payload.rsCode === 'number' ? payload.rsCode : -1;
    const innerCode =
      typeof payload.result?.rsCode === 'number' ? payload.result.rsCode : topLevelCode;
    const status = payload.result?.status;
    const ok = topLevelCode === 0 && innerCode === 0 && (status === 2 || status === 6);

    return {
      ok,
      code: ok ? 0 : innerCode,
      ticketId: payload.result?.ticket_id,
      status,
      raw: payload,
    };
  }
}

const clientCache = new Map<string, AzkivamClient>();

export function getAzkivamClient(env: AzkivamEnv): AzkivamClient {
  const cacheKey = `${env.baseUrl}:${env.merchantId}:${env.username ?? ''}:${env.apiKey ?? ''}`;
  let client = clientCache.get(cacheKey);
  if (!client) {
    client = new AzkivamClient(env);
    clientCache.set(cacheKey, client);
  }
  return client;
}
