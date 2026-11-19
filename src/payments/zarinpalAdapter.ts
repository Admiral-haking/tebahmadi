export type ZarinpalEnv = { merchantId: string; sandbox: boolean };

export type PaymentRequestInput = {
  amount: number;
  description: string;
  callbackURL: string;
  email?: string;
  mobile?: string;
  metadata?: Record<string, string | number | boolean>;
};

export type PaymentRequestOutput = {
  authority: string;
  gatewayUrl: string;
};

export type PaymentVerifyInput = {
  authority: string;
  amount: number;
};

export type PaymentVerifyOutput = {
  ok: boolean;
  refId?: string;
  code: number;
  cardPan?: string;
  raw: unknown;
};

export interface IZarinpalClient {
  requestPayment(input: PaymentRequestInput): Promise<PaymentRequestOutput>;
  verifyPayment(input: PaymentVerifyInput): Promise<PaymentVerifyOutput>;
}

const endpoints = {
  request: {
    sandbox: 'https://sandbox.zarinpal.com/pg/v4/payment/request.json',
    production: 'https://payment.zarinpal.com/pg/v4/payment/request.json',
  },
  verify: {
    sandbox: 'https://sandbox.zarinpal.com/pg/v4/payment/verify.json',
    production: 'https://payment.zarinpal.com/pg/v4/payment/verify.json',
  },
  gateway: {
    sandbox: 'https://sandbox.zarinpal.com/pg/StartPay/',
    production: 'https://payment.zarinpal.com/pg/StartPay/',
  },
} as const;

const SUCCESS_CODES = new Set([100, 101]);

function buildMetadata(input: PaymentRequestInput): Record<string, string> | undefined {
  const metadata: Record<string, string> = {};

  if (input.email) {
    metadata.email = input.email;
  }

  if (input.mobile) {
    metadata.mobile = input.mobile;
  }

  if (input.metadata) {
    for (const [key, value] of Object.entries(input.metadata)) {
      metadata[key] = typeof value === 'string' ? value : String(value);
    }
  }

  return Object.keys(metadata).length ? metadata : undefined;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw Object.assign(new Error(`ZarinPal request failed with HTTP ${response.status}`), {
      status: response.status,
      responseBody: errorText,
    });
  }

  try {
    return (await response.json()) as T;
  } catch (error) {
    throw Object.assign(new Error('Failed to parse ZarinPal response'), {
      cause: error,
    });
  }
}

class ZarinpalClient implements IZarinpalClient {
  private readonly env: ZarinpalEnv;
  private readonly requestUrl: string;
  private readonly verifyUrl: string;
  private readonly gatewayBase: string;

  constructor(env: ZarinpalEnv) {
    this.env = env;
    const mode = env.sandbox ? 'sandbox' : 'production';
    this.requestUrl = endpoints.request[mode];
    this.verifyUrl = endpoints.verify[mode];
    this.gatewayBase = endpoints.gateway[mode];
  }

  async requestPayment(input: PaymentRequestInput): Promise<PaymentRequestOutput> {
    const metadata = buildMetadata(input);
    const payload = await postJson<ZarinpalRequestResponse>(this.requestUrl, {
      merchant_id: this.env.merchantId,
      amount: input.amount,
      callback_url: input.callbackURL,
      description: input.description,
      metadata,
      currency: 'IRT'
    });

    const data = payload?.data ?? payload;
    const errors = payload?.errors;
    const code = typeof data?.code === 'number' ? data.code : typeof data?.Status === 'number' ? data.Status : undefined;

    if (!code || !SUCCESS_CODES.has(code)) {
      throw Object.assign(new Error(`ZarinPal request failed with code ${code ?? 'unknown'}`), {
        code,
        payload,
        errors,
      });
    }

    const authority = data?.authority ?? data?.Authority;
    if (!authority) {
      throw Object.assign(new Error('ZarinPal response missing authority'), {
        payload,
      });
    }

    return {
      authority,
      gatewayUrl: `${this.gatewayBase}${authority}`,
    };
  }

  async verifyPayment(input: PaymentVerifyInput): Promise<PaymentVerifyOutput> {
    const payload = await postJson<ZarinpalVerifyResponse>(this.verifyUrl, {
      merchant_id: this.env.merchantId,
      amount: input.amount,
      authority: input.authority,
    });

    const data = payload?.data ?? payload;
    const code = typeof data?.code === 'number' ? data.code : typeof data?.Status === 'number' ? data.Status : -1;

    return {
      ok: SUCCESS_CODES.has(code),
      refId: data?.ref_id ?? data?.RefID,
      code,
      cardPan: data?.card_pan ?? data?.CardPan,
      raw: payload,
    };
  }
}

const clientCache = new Map<string, IZarinpalClient>();

export function getZarinpalClient(env: ZarinpalEnv): IZarinpalClient {
  const cacheKey = `${env.merchantId}:${env.sandbox ? 'sandbox' : 'production'}`;

  let client = clientCache.get(cacheKey);
  if (!client) {
    client = new ZarinpalClient(env);
    clientCache.set(cacheKey, client);
  }

  return client;
}

interface RequestShape {
  code?: number;
  Status?: number;
  message?: string;
  authority?: string;
  Authority?: string;
  fee_type?: string;
  fee?: number;
}

interface VerifyShape {
  code?: number;
  Status?: number;
  message?: string;
  card_pan?: string;
  card_hash?: string;
  card_pan_masked?: string;
  ref_id?: string;
  RefID?: string;
  CardPan?: string;
  fee_type?: string;
  fee?: number;
}

interface ZarinpalRequestResponse extends RequestShape {
  data?: RequestShape;
  errors?: Array<{ code?: number; message?: string }>;
}

interface ZarinpalVerifyResponse extends VerifyShape {
  data?: VerifyShape;
  errors?: Array<{ code?: number; message?: string }>;
}
