import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { connectMongoose } from '@/lib/mongoose';
import { createInvoice, listInvoicesForUser } from '@/orders/services/invoiceService';
import { invoicePricingSchema } from '@/orders/validation/invoiceSchemas';
import { requirePermission } from '@/lib/auth';

const KNOWN_BAD_REQUEST_PREFIXES = [
  'Offer invalid',
  'Offer redemption failed',
  'Transport quote failed',
  'Product',
  'Variant',
  'Insufficient inventory',
];

function isKnownClientError(error: Error) {
  return KNOWN_BAD_REQUEST_PREFIXES.some((prefix) => error.message.startsWith(prefix));
}

export async function GET(request: NextRequest) {
  await connectMongoose();
  const user = await requirePermission(request, 'orders:read');
  const url = new URL(request.url);
  const userId = url.searchParams.get('userId');
  if (!userId) {
    return NextResponse.json({ error: 'userId query param required' }, { status: 400 });
  }

  const privileged = new Set(['admin', 'manager']);
  const isPrivileged = (user.roles ?? []).some((role) => privileged.has(role));
  if (!isPrivileged && userId !== user._id.toString()) {
    return NextResponse.json({ error: 'forbidden_for_user' }, { status: 403 });
  }

  try {
    const limitParam = url.searchParams.get('limit');
    const limit = limitParam ? Math.min(100, Math.max(1, Number(limitParam))) : 50;
    const invoices = await listInvoicesForUser(userId, limit);
    return NextResponse.json({ data: invoices });
  } catch (error) {
    console.error('Failed to list invoices', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  await connectMongoose();
  const user = await requirePermission(request, 'orders:write');
  try {
    const json = await request.json();
    // Capture torob_clid from cookie for order tracking attribution
    const torobClid = request.cookies.get('torob_clid')?.value || undefined;
    if (torobClid) {
      json.torobClid = torobClid;
    }
    const parsed = invoicePricingSchema.parse(json);
    const privileged = new Set(['admin', 'manager']);
    const isPrivileged = (user.roles ?? []).some((role) => privileged.has(role));
    if (!isPrivileged && parsed.userId !== user._id.toString()) {
      return NextResponse.json({ error: 'forbidden_for_user' }, { status: 403 });
    }
    const invoice = await createInvoice(parsed);
    return NextResponse.json({ data: invoice }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    if (error instanceof Error && isKnownClientError(error)) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Failed to create invoice', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
