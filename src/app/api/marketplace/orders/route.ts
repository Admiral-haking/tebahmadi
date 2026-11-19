import { NextRequest, NextResponse } from 'next/server';
import { submitShopinoOrder } from '@/marketplace/shopinoService';
import { HttpError } from '@/lib/auth';
import { jsonError } from '@/lib/http';

export const runtime = 'nodejs';

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    let payload: unknown;
    try {
      payload = await req.json();
    } catch {
      return jsonError(400, 'Invalid JSON body');
    }

    const result = await submitShopinoOrder(payload);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof HttpError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : 'Failed to submit order';
    console.error('[Shopino API] Error submitting order:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
