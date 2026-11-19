import { NextResponse } from 'next/server';

export function jsonError(status: number, message: string): NextResponse {
  return NextResponse.json({ error: message }, { status });
}
