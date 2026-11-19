export type DigipayEnv = {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  username: string;
  password: string;
};

export type DigipayCreateTicketInput = {
  amountRial: number;
  cellNumber: string;
  providerId: string;
  callbackUrl: string;
  basketDetails?: {
    basketId: string;
    items: Array<{
      sellerId: string;
      supplierId: string;
      productCode: string;
      brand: string;
      productType: number;
      count: number;
      categoryId: string;
    }>;
  };
  additionalInfo?: Record<string, unknown>;
  preferredGateway?: number;
};

export type DigipayCreateTicketOutput = {
  redirectUrl: string;
  ticket: string;
  raw: unknown;
};

export type DigipayVerifyOutput = {
  ok: boolean;
  code: number;
  trackingCode?: string;
  providerId?: string;
  message?: string;
  paymentGateway?: number;
  amount?: number;
  raw: unknown;
};

type DigipayAuthResult = {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
};

type DigipayCreateTicketResult = {
  redirectUrl?: string;
  ticket?: string;
  result?: {
    status?: number;
    message?: string;
    level?: string;
  };
};

type DigipayVerifyResult = {
  result?: {
    status?: number;
    message?: string;
    level?: string;
  };
  trackingCode?: string;
  providerId?: string;
  paymentGateway?: number;
  amount?: number;
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
    throw Object.assign(new Error('Failed to parse Digipay response'), {
      cause: error,
      body: text,
    });
  }
}

class DigipayClient {
  private readonly baseUrl: string;
  private readonly basicAuth: string;
  private readonly username: string;
  private readonly password: string;
  private accessToken?: string;
  private refreshToken?: string;
  private accessTokenExpiresAt = 0;
  private authenticatePromise?: Promise<string>;

  constructor(env: DigipayEnv) {
    this.baseUrl = trimTrailingSlash(env.baseUrl);
    this.basicAuth = `Basic ${Buffer.from(`${env.clientId}:${env.clientSecret}`).toString('base64')}`;
    this.username = env.username;
    this.password = env.password;
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
    const formData = new URLSearchParams();
    formData.append('username', this.username);
    formData.append('password', this.password);
    formData.append('grant_type', 'password');

    const response = await fetch(`${this.baseUrl}/oauth/token`, {
      method: 'POST',
      headers: {
        Authorization: this.basicAuth,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw Object.assign(
        new Error(`Digipay auth failed with HTTP ${response.status}`),
        {
          status: response.status,
          body: errorText,
        },
      );
    }

    const payload = await parseJson<DigipayAuthResult>(response);

    if (!payload.access_token) {
      throw Object.assign(new Error('Digipay auth response missing access_token'), { payload });
    }

    const expiresIn = typeof payload.expires_in === 'number' ? payload.expires_in : 3599;
    const refreshSkewSeconds = 300;
    const effectiveTtlSeconds = Math.max(60, expiresIn - refreshSkewSeconds);

    this.accessToken = payload.access_token;
    this.refreshToken = payload.refresh_token;
    this.accessTokenExpiresAt = Date.now() + effectiveTtlSeconds * 1000;

    return this.accessToken;
  }

  private async postAuthorized<T>(
    path: string,
    body: unknown,
    allowRetry = true,
  ): Promise<T> {
    const normalizedPath = normalizePath(path);
    const accessToken = await this.authenticate();

    const response = await fetch(`${this.baseUrl}${normalizedPath}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Agent: 'WEB',
        'Digipay-Version': '2022-02-02',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    });

    if (response.status === 401 && allowRetry) {
      this.clearAccessToken();
      await this.authenticate(true);
      return this.postAuthorized<T>(path, body, false);
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw Object.assign(
        new Error(`Digipay request failed with HTTP ${response.status}`),
        {
          status: response.status,
          body: errorText,
        },
      );
    }

    const payload = await parseJson<T>(response);
    return payload;
  }

  async createTicket(input: DigipayCreateTicketInput): Promise<DigipayCreateTicketOutput> {
    const body: Record<string, unknown> = {
      amount: input.amountRial,
      cellNumber: input.cellNumber,
      providerId: input.providerId,
      callbackUrl: input.callbackUrl,
    };

    if (input.basketDetails) {
      body.basketDetailsDto = {
        basketId: input.basketDetails.basketId,
        items: input.basketDetails.items,
      };
    }

    const additionalInfo = { ...(input.additionalInfo ?? {}) };
    if (input.preferredGateway !== undefined && additionalInfo.preferredGateway === undefined) {
      additionalInfo.preferredGateway = input.preferredGateway;
    }
    if (Object.keys(additionalInfo).length > 0) {
      body.additionalInfo = additionalInfo;
    }

    const payload = await this.postAuthorized<DigipayCreateTicketResult>(
      '/tickets/business?type=11',
      body,
    );

    const redirectUrl = payload.redirectUrl;
    const ticket = payload.ticket;

    if (!redirectUrl || !ticket) {
      throw Object.assign(
        new Error('Digipay createTicket response missing redirectUrl or ticket'),
        { payload },
      );
    }

    return {
      redirectUrl,
      ticket,
      raw: payload,
    };
  }

  async verifyPurchase(input: {
    trackingCode: string;
    providerId: string;
    type?: string | number;
  }): Promise<DigipayVerifyOutput> {
    try {
      const type = input.type ?? 11;
      const payload = await this.postAuthorized<DigipayVerifyResult>(
        `/purchases/verify?type=${encodeURIComponent(String(type))}`,
        {
          trackingCode: input.trackingCode,
          providerId: input.providerId,
        },
      );

      const status = payload.result?.status ?? -1;
      const message = payload.result?.message;
      const ok = status === 0;

      return {
        ok,
        code: status,
        trackingCode: payload.trackingCode ?? input.trackingCode,
        providerId: payload.providerId ?? input.providerId,
        paymentGateway: payload.paymentGateway,
        amount: payload.amount,
        message,
        raw: payload,
      };
    } catch (error) {
      const err = error as { status?: number; body?: string };
      return {
        ok: false,
        code: err.status ?? -1,
        message: error instanceof Error ? error.message : 'digipay_verify_failed',
        raw: { error: error instanceof Error ? error.message : String(error) },
      };
    }
  }
}

const clientCache = new Map<string, DigipayClient>();

export function getDigipayClient(env: DigipayEnv): DigipayClient {
  const cacheKey = `${env.baseUrl}:${env.clientId}`;
  let client = clientCache.get(cacheKey);
  if (!client) {
    client = new DigipayClient(env);
    clientCache.set(cacheKey, client);
  }
  return client;
}
