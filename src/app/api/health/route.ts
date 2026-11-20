import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const response = NextResponse.json({
    status: 'ok',
    service: 'tebahmadi-web',
    timestamp: new Date().toISOString(),
  });
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
