import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { connectMongoose } from '@/lib/mongoose';
import { quoteShipping } from '@/orders/services/transportService';
import { transportQuoteSchema } from '@/orders/validation/transportSchemas';

export async function POST(request: NextRequest) {
  try {
    await connectMongoose();
    const json = await request.json();
    const parsed = transportQuoteSchema.parse(json);
    const quote = await quoteShipping({
      carrierId: parsed.carrierId,
      totalWeightGrams: parsed.totalWeightGrams,
      destinationState: parsed.state,
      destinationCity: parsed.city,
      destinationRegion: parsed.destRegion,
    });

    if (!quote.ok) {
      return NextResponse.json({ error: quote.reason }, { status: 400 });
    }

    return NextResponse.json({
      data: {
        price: quote.price,
        breakdown: quote.breakdown,
        carrier: {
          id: quote.carrier._id,
          name: quote.carrier.name,
        },
      },
    });
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    console.error('Failed to quote transport', error);
    return NextResponse.json(
      { error: 'transport_unavailable' },
      { status: 503, headers: { 'Cache-Control': 'no-store', 'Retry-After': '3' } },
    );
  }
}
