import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyReviewRequest } from '@/reviews/services/reviewService';

const schema = z.object({
  token: z.string().trim().min(10, 'invalid_token'),
});

function mapStatus(reason: string): number {
  switch (reason) {
    case 'not_found':
    case 'invoice_missing':
      return 404;
    case 'expired':
      return 410;
    case 'already_submitted':
      return 409;
    default:
      return 400;
  }
}

export async function POST(request: NextRequest) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { token } = parsed.data;
  const result = await verifyReviewRequest(token);
  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: mapStatus(result.reason) });
  }

  return NextResponse.json({ data: result.data });
}
