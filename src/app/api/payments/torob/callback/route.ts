import { NextRequest, NextResponse } from 'next/server';
import { ensureAppBaseUrl } from '@/payments/paymentCalc';

function pickSingle(value: unknown): string | undefined {
  if (Array.isArray(value)) return pickSingle(value[0]);
  if (value === null || value === undefined) return undefined;
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function toVerifyRedirectUrl(input: {
  request: NextRequest;
  transactionId?: string;
  tx?: string;
  invoiceId?: string;
  state?: string;
}) {
  const base = ensureAppBaseUrl(process.env.APP_BASE_URL);
  const url = new URL('/payments/verify', base);
  url.searchParams.set('gateway', 'torob');

  const tx = input.tx ?? input.transactionId;
  if (tx) {
    url.searchParams.set('tx', tx);
  }
  if (input.invoiceId) {
    url.searchParams.set('invoiceId', input.invoiceId);
  }
  if (input.state) {
    url.searchParams.set('state', input.state);
  }
  return url;
}

async function handleCallback(req: NextRequest) {
  const queryTx = pickSingle(
    req.nextUrl.searchParams.get('tx') ??
    req.nextUrl.searchParams.get('transactionId') ??
    req.nextUrl.searchParams.get('paymentTransactionId'),
  );
  const queryInvoiceId = pickSingle(
    req.nextUrl.searchParams.get('invoiceId') ??
    req.nextUrl.searchParams.get('invoice_id') ??
    req.nextUrl.searchParams.get('orderId'),
  );
  const queryState = pickSingle(req.nextUrl.searchParams.get('state'));

  let bodyTransactionId: string | undefined;
  let bodyState: string | undefined;

  const contentType = req.headers.get('content-type') ?? '';
  if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
    const formData = await req.formData();
    bodyTransactionId = pickSingle(formData.get('transactionId') ?? formData.get('tx') ?? formData.get('paymentTransactionId'));
    bodyState = pickSingle(formData.get('state') ?? formData.get('status'));
  } else if (contentType.includes('application/json')) {
    const payload = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    bodyTransactionId = pickSingle(payload.transactionId ?? payload.tx ?? payload.paymentTransactionId);
    bodyState = pickSingle(payload.state ?? payload.status);
  }

  const redirectUrl = toVerifyRedirectUrl({
    request: req,
    transactionId: bodyTransactionId,
    tx: queryTx,
    invoiceId: queryInvoiceId,
    state: bodyState ?? queryState,
  });

  return NextResponse.redirect(redirectUrl, 303);
}

export async function POST(req: NextRequest) {
  return handleCallback(req);
}

export async function GET(req: NextRequest) {
  return handleCallback(req);
}
