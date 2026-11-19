import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { ZodError } from 'zod';
import { connectMongoose } from '@/lib/mongoose';
import { TransportModel } from '@/orders/models/Transport';
import { InvoiceModel } from '@/orders/models/Invoice';
import { transportUpdateSchema } from '@/orders/validation/transportSchemas';
import { requirePermission } from '@/lib/auth';

function isValidId(id: string) {
  return Types.ObjectId.isValid(id);
}

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const params = await context.params;
  await connectMongoose();
  const { id } = params;
  if (!isValidId(id)) {
    return NextResponse.json({ error: 'Invalid carrier id' }, { status: 400 });
  }

  const carrier = await TransportModel.findById(id).lean();
  if (!carrier) {
    return NextResponse.json({ error: 'Carrier not found' }, { status: 404 });
  }

  return NextResponse.json({ data: carrier });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const params = await context.params;
  await connectMongoose();
  const user = await requirePermission(request, 'orders:write');
  const privileged = new Set(['admin', 'manager']);
  if (!(user.roles ?? []).some((role) => privileged.has(role))) {
    return NextResponse.json({ error: 'forbidden_for_user' }, { status: 403 });
  }
  const { id } = params;
  if (!isValidId(id)) {
    return NextResponse.json({ error: 'Invalid carrier id' }, { status: 400 });
  }

  try {
    const json = await request.json();
    const parsed = transportUpdateSchema.parse(json);
    const updated = await TransportModel.findByIdAndUpdate(id, parsed, {
      new: true,
      runValidators: true,
    }).lean();

    if (!updated) {
      return NextResponse.json({ error: 'Carrier not found' }, { status: 404 });
    }

    return NextResponse.json({ data: updated });
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    const mongoError = error as { code?: number };
    if (mongoError?.code === 11000) {
      return NextResponse.json({ error: 'Carrier name already exists' }, { status: 409 });
    }
    console.error('Failed to update carrier', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const params = await context.params;
  await connectMongoose();
  const user = await requirePermission(request, 'orders:write');
  const privileged = new Set(['admin', 'manager']);
  if (!(user.roles ?? []).some((role) => privileged.has(role))) {
    return NextResponse.json({ error: 'forbidden_for_user' }, { status: 403 });
  }
  const { id } = params;
  if (!isValidId(id)) {
    return NextResponse.json({ error: 'Invalid carrier id' }, { status: 400 });
  }

  const invoiceExists = await InvoiceModel.exists({ transportId: id });
  if (invoiceExists) {
    return NextResponse.json(
      { error: 'Carrier is referenced by existing invoices; disable instead' },
      { status: 409 }
    );
  }

  const removed = await TransportModel.findByIdAndDelete(id).lean();
  if (!removed) {
    return NextResponse.json({ error: 'Carrier not found' }, { status: 404 });
  }

  return NextResponse.json({ data: removed });
}
