import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { connectMongoose } from '@/lib/mongoose';
import { jsonError } from '@/lib/http';
import { listGalleryAll, listGalleryForUser } from '@/media/services/mediaService';
import { getAuth, hasPermission } from '@/lib/auth';
import UserModel from '@/models/User';

export const runtime = 'nodejs';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const auth = getAuth(req);
  if (!auth) {
    return jsonError(401, 'Unauthorized');
  }

  if (!Types.ObjectId.isValid(auth.sub)) {
    return jsonError(401, 'Unauthorized');
  }

  const limitParam = req.nextUrl.searchParams.get('limit');
  const cursorParam = req.nextUrl.searchParams.get('cursor');
  if (cursorParam && !Types.ObjectId.isValid(cursorParam)) {
    return jsonError(400, 'Invalid cursor');
  }
  const cursor = cursorParam ?? undefined;
  const parsedLimit = limitParam ? Number(limitParam) : undefined;
  const limit = parsedLimit && Number.isFinite(parsedLimit) ? parsedLimit : undefined;

  await connectMongoose();

  const user = await UserModel.findById(new Types.ObjectId(auth.sub)).exec();
  if (!user) {
    return jsonError(401, 'Unauthorized');
  }

  const canReadAll = hasPermission(user, 'media:read:all');

  if (!canReadAll && !hasPermission(user, 'media:read')) {
    return jsonError(403, 'Forbidden');
  }

  const result = canReadAll
    ? await listGalleryAll({ limit, cursor })
    : await listGalleryForUser(user._id, { limit, cursor });

  return NextResponse.json(result);
}
