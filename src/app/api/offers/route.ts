import { NextRequest, NextResponse } from 'next/server';
import { connectMongoose } from '@/lib/mongoose';
import { OfferModel } from '@/orders/models/Offer';
import { offerCreateSchema } from '@/orders/validation/offerSchemas';
import { ZodError } from 'zod';
import { requirePermission } from '@/lib/auth';

export async function GET(request: NextRequest) {
  await connectMongoose();
  const url = new URL(request.url);
  const query: Record<string, unknown> = {};

  const isActiveParam = url.searchParams.get('isActive');
  if (isActiveParam !== null) {
    query.isActive = isActiveParam === 'true';
  }

  const codeParam = url.searchParams.get('code');
  if (codeParam) {
    query.code = codeParam.trim().toUpperCase();
  }

  const typeParam = url.searchParams.get('type');
  if (typeParam) {
    query.type = typeParam;
  }

  const offers = await OfferModel.find(query).sort({ createdAt: -1 }).lean();
  return NextResponse.json({ data: offers });
}

export async function POST(request: NextRequest) {
  await connectMongoose();
  await requirePermission(request, 'promotions:write');

  try {
    const json = await request.json();
    const parsed = offerCreateSchema.parse(json);
    const payload = {
      ...parsed,
      code: parsed.code.trim().toUpperCase(),
    };

    const offer = await OfferModel.create(payload);
    return NextResponse.json({ data: offer }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    const mongoError = error as { code?: number };
    if (mongoError?.code === 11000) {
      return NextResponse.json({ error: 'Offer code already exists' }, { status: 409 });
    }
    console.error('Failed to create offer', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
