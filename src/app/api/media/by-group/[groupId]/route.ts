import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { connectMongoose } from '@/lib/mongoose';
import { jsonError } from '@/lib/http';
import MediaModel from '@/media/models/Media';

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ groupId: string }> };

export async function GET(
  _req: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  const { groupId } = await context.params;
  if (!Types.ObjectId.isValid(groupId)) {
    return jsonError(400, 'Invalid media group identifier');
  }

  await connectMongoose();

  const mediaDoc = await MediaModel.findOne({ groupId: new Types.ObjectId(groupId) }).exec();
  if (!mediaDoc) {
    return jsonError(404, 'Media group not found');
  }

  return NextResponse.json({ media: mediaDoc.toJSON() });
}
