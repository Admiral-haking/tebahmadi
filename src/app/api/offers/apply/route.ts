import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { connectMongoose } from '@/lib/mongoose';
import { validateForCart } from '@/orders/services/offerService';
import { offerApplySchema } from '@/orders/validation/offerSchemas';

export async function POST(request: NextRequest) {
  await connectMongoose();
  try {
    const json = await request.json();
    const parsed = offerApplySchema.parse(json);
    const result = await validateForCart({
      code: parsed.code,
      userId: parsed.userId,
      subtotal: parsed.subtotal,
      lineItems: parsed.lines,
      now: parsed.now ?? new Date(),
    });

    return NextResponse.json({ data: result });
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    console.error('Failed to apply offer', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
