import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { connectMongoose } from '@/lib/mongoose';
import { jsonError } from '@/lib/http';
import { HttpError, requireAuth } from '@/lib/auth';
import { userUpdateSchema } from '@/lib/schemas';
import UserModel from '@/models/User';

export const runtime = 'nodejs';

export async function GET(req: NextRequest): Promise<NextResponse> {
  let auth;
  try {
    auth = requireAuth(req);
  } catch (err) {
    if (err instanceof HttpError) {
      return jsonError(err.status, err.message);
    }
    throw err;
  }
  if (!Types.ObjectId.isValid(auth.sub)) {
    return jsonError(401, 'Unauthorized');
  }

  await connectMongoose();

  const user = await UserModel.findById(new Types.ObjectId(auth.sub)).exec();
  if (!user) {
    return jsonError(404, 'User not found');
  }

  return NextResponse.json({ user: user.toJSON() });
}

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  let auth;
  try {
    auth = requireAuth(req);
  } catch (err) {
    if (err instanceof HttpError) {
      return jsonError(err.status, err.message);
    }
    throw err;
  }
  if (!Types.ObjectId.isValid(auth.sub)) {
    return jsonError(401, 'Unauthorized');
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return jsonError(400, 'Invalid JSON body');
  }

  const parsed = userUpdateSchema.safeParse(payload);
  if (!parsed.success) {
    return jsonError(400, 'Invalid update payload');
  }

  const updates: Record<string, unknown> = {};
  const { avatar, ...rest } = parsed.data;

  Object.entries(rest).forEach(([key, value]) => {
    if (value !== undefined) {
      updates[key] = value;
    }
  });

  if (avatar) {
    const { originalId, mobileId, thumbId, groupId } = avatar;
    if (
      !Types.ObjectId.isValid(originalId) ||
      !Types.ObjectId.isValid(mobileId) ||
      !Types.ObjectId.isValid(thumbId) ||
      !Types.ObjectId.isValid(groupId)
    ) {
      return jsonError(400, 'Avatar identifiers must be valid ObjectIds');
    }
    updates.avatar = {
      originalId: new Types.ObjectId(originalId),
      mobileId: new Types.ObjectId(mobileId),
      thumbId: new Types.ObjectId(thumbId),
      groupId: new Types.ObjectId(groupId),
    };
  }

  if (Object.keys(updates).length === 0) {
    return jsonError(400, 'No updates provided');
  }

  await connectMongoose();

  const updatedUser = await UserModel.findByIdAndUpdate(new Types.ObjectId(auth.sub), updates, {
    new: true,
    runValidators: true,
  }).exec();

  if (!updatedUser) {
    return jsonError(404, 'User not found');
  }

  return NextResponse.json({ user: updatedUser.toJSON() });
}
