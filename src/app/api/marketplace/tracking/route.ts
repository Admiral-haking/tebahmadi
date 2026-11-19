import { NextRequest, NextResponse } from 'next/server';
import { getShopinoTrackingCodes } from '@/marketplace/shopinoService';
import { jsonError } from '@/lib/http';
import type { ShopinoTrackingPayload, ShopinoTrackingResponse } from '@/marketplace/shopinoTypes';

export const runtime = 'nodejs';

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    let payload: ShopinoTrackingPayload;
    try {
      payload = await req.json();
    } catch {
      return jsonError(400, 'Invalid JSON body');
    }

    if (!Array.isArray(payload.order_ids) || payload.order_ids.length === 0) {
      return jsonError(400, 'order_ids array is required');
    }

    const codes = await getShopinoTrackingCodes(payload.order_ids);
    const response: ShopinoTrackingResponse = { codes };
    return NextResponse.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to get tracking codes';
    console.error('[Shopino API] Error getting tracking codes:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
