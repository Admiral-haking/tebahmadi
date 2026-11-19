import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { ZodError } from 'zod';
import { connectMongoose } from '@/lib/mongoose';
import { getInvoiceById, updateInvoiceProgress, updateInvoiceStatus } from '@/orders/services/invoiceService';
import { invoicePatchUpdateSchema } from '@/orders/validation/invoiceSchemas';
import { requirePermission } from '@/lib/auth';

function isValidId(id: string) {
  return Types.ObjectId.isValid(id);
}

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const params = await context.params;
  await connectMongoose();
  const user = await requirePermission(request, 'orders:read');
  const { id } = params;
  if (!isValidId(id)) {
    return NextResponse.json({ error: 'Invalid invoice id' }, { status: 400 });
  }

  const invoice = await getInvoiceById(id);
  if (!invoice) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
  }

  const privileged = new Set(['admin', 'manager']);
  const isPrivileged = (user.roles ?? []).some((role) => privileged.has(role));
  if (!isPrivileged && invoice.userId?.toString() !== user._id.toString()) {
    return NextResponse.json({ error: 'forbidden_for_user' }, { status: 403 });
  }

  return NextResponse.json({ data: invoice });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const params = await context.params;
  await connectMongoose();
  const user = await requirePermission(request, 'orders:write');
  const { id } = params;
  if (!isValidId(id)) {
    return NextResponse.json({ error: 'Invalid invoice id' }, { status: 400 });
  }

  const privileged = new Set(['admin', 'manager']);
  const isPrivileged = (user.roles ?? []).some((role) => privileged.has(role));
  if (!isPrivileged) {
    return NextResponse.json({ error: 'forbidden_for_user' }, { status: 403 });
  }

  try {
    const json = await request.json();
    const parsed = invoicePatchUpdateSchema.parse(json);
    let updatedInvoice = null;

    if (parsed.status) {
      const result = await updateInvoiceStatus(id, parsed.status);
      if (!result.ok) {
        const status = result.reason === 'not_found' ? 404 : 400;
        return NextResponse.json({ error: result.reason }, { status });
      }
      updatedInvoice = result.invoice;
    }

    if (parsed.progress) {
      const result = await updateInvoiceProgress(id, parsed.progress, {
        trackingCode: parsed.trackingCode,
      });
      if (!result.ok) {
        const status = result.reason === 'not_found' ? 404 : 400;
        return NextResponse.json({ error: result.reason }, { status });
      }
      updatedInvoice = result.invoice;
    }

    return NextResponse.json({ data: updatedInvoice });
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    console.error('Failed to update invoice status', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
