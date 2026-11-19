import { NextResponse } from 'next/server';
import { clearAuthCookie } from '@/lib/auth';

export const runtime = 'nodejs';

export async function POST(): Promise<NextResponse> {
  const response = NextResponse.json({ ok: true });
  clearAuthCookie(response);
  return response;
}
