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
  const base = ensureAppBaseUrl(process.env.APP_BASE_URL);
  const url = new URL('/payments/verify', base);
  const params = req.nextUrl.searchParams;

  url.searchParams.set('gateway', 'snapppay');

  const tx = pickSingle(
    params.get('tx') ??
    params.get('transactionId') ??
    params.get('paymentTransactionId') ??
    body.tx ??
    body.transactionId ??
    body.paymentTransactionId,
  );
  const invoiceId = pickSingle(
    params.get('invoiceId') ??
    params.get('invoice_id') ??
    params.get('orderId') ??
    body.invoiceId ??
    body.invoice_id ??
    body.orderId,
  );
  // FIX: If Snapp Pay does not provide a state param (just redirects back),
  // assume the payment was successful (OK)
  const state = pickSingle(body.state ?? params.get('state')) ?? 'OK';
  const amount = pickSingle(body.amount ?? params.get('amount'));

  if (tx) url.searchParams.set('tx', tx);
  if (invoiceId) url.searchParams.set('invoiceId', invoiceId);
  if (state) url.searchParams.set('state', state);
  if (amount) url.searchParams.set('amount', amount);

  return NextResponse.redirect(url, 303);
}

export async function POST(req: NextRequest) {
  return handleCallback(req);
}

export async function GET(req: NextRequest) {
  return handleCallback(req);
}
