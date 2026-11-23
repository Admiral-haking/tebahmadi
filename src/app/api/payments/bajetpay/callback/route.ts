import { NextRequest, NextResponse } from 'next/server';
import { ensureAppBaseUrl } from '@/payments/paymentCalc';
import { normalizeBajetPayCallback } from '@/payments/bajetpayAdapter';

async function readBody(request: NextRequest): Promise<Record<string, unknown>> {
  const contentType = request.headers.get('content-type') ?? '';
  if (
    contentType.includes('application/x-www-form-urlencoded') ||
    contentType.includes('multipart/form-data')
  ) {
    return Object.fromEntries((await request.formData()).entries());
  }
  if (contentType.includes('application/json')) {
    return (await request.json().catch(() => ({}))) as Record<string, unknown>;
  }
  return {};
}

async function handleCallback(request: NextRequest) {
  const body = await readBody(request);
  const query = Object.fromEntries(request.nextUrl.searchParams.entries());
  const callback = normalizeBajetPayCallback({ body, query });
  const url = new URL('/payments/verify', ensureAppBaseUrl(process.env.APP_BASE_URL));
  url.searchParams.set('gateway', 'bajetpay');

  if (callback) {
    url.searchParams.set('tx', callback.transactionId);
    url.searchParams.set('invoiceId', callback.invoiceId);
    if (callback.referenceId) url.searchParams.set('referenceId', callback.referenceId);
    if (callback.state) url.searchParams.set('state', callback.state);
    if (callback.amountRial !== undefined) {
      url.searchParams.set('amount', String(callback.amountRial));
    }
  }

  return NextResponse.redirect(url, 303);
}

export async function GET(request: NextRequest) {
  return handleCallback(request);
}

export async function POST(request: NextRequest) {
  return handleCallback(request);
}
