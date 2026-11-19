import { NextRequest, NextResponse } from 'next/server';
import { ensureAppBaseUrl } from '@/payments/paymentCalc';

function pickSingle(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    return pickSingle(value[0]);
  }
  if (value === null || value === undefined) {
    return undefined;
  }
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function toVerifyRedirectUrl(input: {
  tx?: string;
  invoiceId?: string;
  trackingCode?: string;
  providerId?: string;
  amount?: string;
  result?: string;
  type?: string;
}) {
  const base = ensureAppBaseUrl(process.env.APP_BASE_URL);
  const url = new URL('/payments/verify', base);
  url.searchParams.set('gateway', 'digipay');

  if (input.tx) url.searchParams.set('tx', input.tx);
  if (input.invoiceId) url.searchParams.set('invoiceId', input.invoiceId);
  if (input.trackingCode) url.searchParams.set('trackingCode', input.trackingCode);
  if (input.providerId) url.searchParams.set('providerId', input.providerId);
  if (input.amount) url.searchParams.set('amount', input.amount);
  if (input.result) url.searchParams.set('result', input.result);
  if (input.type) url.searchParams.set('type', input.type);

  return url;
}

async function readBody(req: NextRequest): Promise<Record<string, unknown>> {
  const contentType = req.headers.get('content-type') ?? '';
  if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
    const formData = await req.formData();
    return Object.fromEntries(formData.entries());
  }
  if (contentType.includes('application/json')) {
    return (await req.json().catch(() => ({}))) as Record<string, unknown>;
  }
  return {};
}

async function handleCallback(req: NextRequest) {
  const body = await readBody(req);
  const params = req.nextUrl.searchParams;

  const redirectUrl = toVerifyRedirectUrl({
    tx: pickSingle(params.get('tx') ?? params.get('transactionId')),
    invoiceId: pickSingle(params.get('invoiceId')),
    trackingCode: pickSingle(body.trackingCode ?? params.get('trackingCode')),
    providerId: pickSingle(body.providerId ?? params.get('providerId')),
    amount: pickSingle(body.amount ?? params.get('amount')),
    result: pickSingle(body.result ?? params.get('result')),
    type: pickSingle(body.type ?? params.get('type')),
  });

  return NextResponse.redirect(redirectUrl, 303);
}

export async function POST(req: NextRequest) {
  return handleCallback(req);
}

export async function GET(req: NextRequest) {
  return handleCallback(req);
}
