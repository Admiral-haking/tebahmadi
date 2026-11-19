import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { connectMongoose } from '@/lib/mongoose';
import { previewInvoice } from '@/orders/services/invoiceService';
import { invoicePricingSchema } from '@/orders/validation/invoiceSchemas';
import { requirePermission } from '@/lib/auth';

export async function POST(request: NextRequest) {
  await connectMongoose();
  const user = await requirePermission(request, 'orders:write');
  try {
    const json = await request.json();
    const parsed = invoicePricingSchema.parse(json);
    const privileged = new Set(['admin', 'manager']);
    const isPrivileged = (user.roles ?? []).some((role) => privileged.has(role));
    if (!isPrivileged && parsed.userId !== user._id.toString()) {
      return NextResponse.json({ error: 'forbidden_for_user' }, { status: 403 });
    }
    const preview = await previewInvoice(parsed);
    return NextResponse.json({ data: preview });
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    console.error('Failed to preview invoice', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
