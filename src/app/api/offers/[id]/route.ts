import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { ZodError } from 'zod';
import { connectMongoose } from '@/lib/mongoose';
import { OfferModel } from '@/orders/models/Offer';
import { offerUpdateSchema } from '@/orders/validation/offerSchemas';
import { requirePermission } from '@/lib/auth';

function validateId(id: string) {
  return Types.ObjectId.isValid(id);
}

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const params = await context.params;
  await connectMongoose();
  const { id } = params;
  if (!validateId(id)) {
    return NextResponse.json({ error: 'Invalid offer id' }, { status: 400 });
  }

  const offer = await OfferModel.findById(id).lean();
  if (!offer) {
    return NextResponse.json({ error: 'Offer not found' }, { status: 404 });
  }

  return NextResponse.json({ data: offer });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const params = await context.params;
  await connectMongoose();
  await requirePermission(request, 'promotions:write');
  const { id } = params;
  if (!validateId(id)) {
    return NextResponse.json({ error: 'Invalid offer id' }, { status: 400 });
  }

  try {
    const json = await request.json();
    const parsed = offerUpdateSchema.parse(json);
    const payload = {
      ...parsed,
      ...(parsed.code ? { code: parsed.code.trim().toUpperCase() } : {}),
    };

    const updated = await OfferModel.findByIdAndUpdate(id, payload, {
      new: true,
      runValidators: true,
    }).lean();

    if (!updated) {
      return NextResponse.json({ error: 'Offer not found' }, { status: 404 });
    }

    return NextResponse.json({ data: updated });
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    const mongoError = error as { code?: number };
    if (mongoError?.code === 11000) {
      return NextResponse.json({ error: 'Offer code already exists' }, { status: 409 });
    }
    console.error('Failed to update offer', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const params = await context.params;
  await connectMongoose();
  await requirePermission(request, 'promotions:write');
  const { id } = params;
  if (!validateId(id)) {
    return NextResponse.json({ error: 'Invalid offer id' }, { status: 400 });
  }

  const updated = await OfferModel.findByIdAndUpdate(
    id,
    { isActive: false },
    { new: true }
  ).lean();

  if (!updated) {
    return NextResponse.json({ error: 'Offer not found' }, { status: 404 });
  }

  return NextResponse.json({ data: updated });
}
