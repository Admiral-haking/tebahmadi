import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';

import { runTapinStatusSync } from '@/services/tapin/sync';

export const runtime = 'nodejs';
export const maxDuration = 120;

function isAuthorized(request: NextRequest) {
  const expected = process.env.SYNC_CRON_SECRET?.trim() || process.env.CRON_SECRET?.trim();
  if (!expected) return false;
  const provided = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
  if (!provided) return false;
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  return (
    expectedBuffer.length === providedBuffer.length &&
    timingSafeEqual(expectedBuffer, providedBuffer)
  );
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { error: process.env.SYNC_CRON_SECRET || process.env.CRON_SECRET ? 'unauthorized' : 'sync_cron_not_configured' },
      { status: process.env.SYNC_CRON_SECRET || process.env.CRON_SECRET ? 401 : 503 },
    );
  }
  try {
    const result = await runTapinStatusSync();
    return NextResponse.json({ status: 'succeeded', result }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'همگام‌سازی خودکار تاپین ناموفق بود.' }, { status: 502 });
  }
}
