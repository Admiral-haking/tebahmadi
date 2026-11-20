import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectMongoose } from '@/lib/mongoose';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    if (mongoose.connection.readyState !== 1) {
      await connectMongoose();
    }

    const response = NextResponse.json({
      status: 'ready',
      service: 'tebahmadi-web',
      database: 'ok',
      timestamp: new Date().toISOString(),
    });
    response.headers.set('Cache-Control', 'no-store');
    return response;
  } catch (error) {
    console.error('[readiness] database unavailable', error instanceof Error ? error.message : 'unknown error');
    const response = NextResponse.json(
      { status: 'not_ready', service: 'tebahmadi-web', database: 'unavailable' },
      { status: 503 },
    );
    response.headers.set('Cache-Control', 'no-store');
    return response;
  }
}
