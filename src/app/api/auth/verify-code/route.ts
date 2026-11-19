import { NextRequest, NextResponse } from 'next/server';
import { connectMongoose } from '@/lib/mongoose';
import { jsonError } from '@/lib/http';
import { verifyCodeSchema } from '@/lib/schemas';
import { signJwt, setAuthCookie } from '@/lib/auth';
import LoginCodeModel from '@/models/LoginCode';
import UserModel from '@/models/User';

const MAX_ATTEMPTS = 5;

export const runtime = 'nodejs';

export async function POST(req: NextRequest): Promise<NextResponse> {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return jsonError(400, 'Invalid JSON body');
  }

  const parsed = verifyCodeSchema.safeParse(payload);
  if (!parsed.success) {
    return jsonError(400, 'Invalid verification payload');
  }

  const { phone, code } = parsed.data;
  const now = new Date();

  await connectMongoose();

  const loginCode = await LoginCodeModel.findOne({ phone }).exec();
  if (!loginCode) {
    return jsonError(400, 'Verification code not found');
  }

  if (loginCode.expiresAt <= now) {
    await LoginCodeModel.deleteOne({ phone }).exec();
    return jsonError(400, 'Verification code expired');
  }

  if (loginCode.code !== code) {
    if (loginCode.attempts + 1 >= MAX_ATTEMPTS) {
      await LoginCodeModel.deleteOne({ phone }).exec();
      return jsonError(429, 'Too many invalid attempts');
    }

    await LoginCodeModel.updateOne({ phone }, { $inc: { attempts: 1 } }).exec();
    return jsonError(400, 'Invalid verification code');
  }

  await LoginCodeModel.deleteOne({ phone }).exec();

  const user = await UserModel.findOneAndUpdate(
    { phone },
    { $setOnInsert: { phone } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).exec();

  if (!user) {
    return jsonError(500, 'Unable to create user');
  }

  const token = signJwt({ sub: user._id.toString(), phone: user.phone, roles: user.roles });
  const response = NextResponse.json({ ok: true, user: user.toJSON() });
  setAuthCookie(response, token);
  return response;
}
