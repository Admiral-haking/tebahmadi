import { NextRequest, NextResponse } from 'next/server';
import { customAlphabet } from 'nanoid';
import { connectMongoose } from '@/lib/mongoose';
import { jsonError } from '@/lib/http';
import { requestCodeSchema } from '@/lib/schemas';
import { sendLoginCode } from '@/lib/sms';
import LoginCodeModel from '@/models/LoginCode';

const otp = customAlphabet('0123456789', 6);
const CODE_TTL_MS = 5 * 60 * 1000;
const REQUEST_COOLDOWN_MS = 60 * 1000;

export const runtime = 'nodejs';

export async function POST(req: NextRequest): Promise<NextResponse> {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return jsonError(400, 'Invalid JSON body');
  }

  const parsed = requestCodeSchema.safeParse(payload);
  if (!parsed.success) {
    return jsonError(400, 'Invalid phone number');
  }

  const { phone } = parsed.data;
  const now = new Date();

  await connectMongoose();

  const existing = await LoginCodeModel.findOne({ phone }).exec();
  if (existing && existing.lastRequestedAt) {
    const elapsed = now.getTime() - existing.lastRequestedAt.getTime();
    if (elapsed < REQUEST_COOLDOWN_MS) {
      return jsonError(429, 'Code already requested, please wait before retrying');
    }
  }

  const code = otp();
  const expiresAt = new Date(now.getTime() + CODE_TTL_MS);

  await LoginCodeModel.findOneAndUpdate(
    { phone },
    {
      phone,
      code,
      expiresAt,
      attempts: 0,
      lastRequestedAt: now,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).exec();

  try {
    await sendLoginCode(phone, code);
  } catch {
    // Provider/configuration details must never be exposed to customers.
    return jsonError(502, 'login_unavailable');
  }

  return NextResponse.json({ ok: true });
}
