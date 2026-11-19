import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import mongoose from 'mongoose';
import { getBucket, openDownloadStreamById } from '@/lib/gridfs';
import { connectMongoose } from '@/lib/mongoose';
import { jsonError } from '@/lib/http';
import MediaModel from '@/models/Media';
import UserModel from '@/models/User';
import { HttpError, requirePermission } from '@/lib/auth';
import { redirect } from 'next/navigation';

function nodeStreamToReadable(stream: NodeJS.ReadableStream): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      stream.on('data', (chunk) => controller.enqueue(new Uint8Array(chunk)));
      stream.on('end', () => controller.close());
      stream.on('error', (error) => controller.error(error));
    },
    cancel() {
      const destroy = (stream as NodeJS.ReadableStream & { destroy?: () => void }).destroy;
      if (typeof destroy === 'function') {
        destroy.call(stream);
      }
    },
  });
}

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(
  req: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  const ID = (await context.params).id;
  const type = (await req.nextUrl.searchParams).get("type");

  const id = ID.includes(".") ? ID.split(".")[0] : ID;

  if (!Types.ObjectId.isValid(id)) {
    return jsonError(400, 'Invalid media identifier');
  }




  await connectMongoose();

  let fileId = new Types.ObjectId(id);
  const filesCollection = mongoose.connection.db?.collection('fs.files');
  if (!filesCollection) {
    return jsonError(500, 'GridFS is not initialized');
  }

  type GridFsFileDoc = { contentType?: string; filename?: string };
  const record = await MediaModel.findOne({ _id: fileId });

  if (record) {
    if (type === 'original') fileId = record.originalId
    else if (type === 'mobile' && record.mobileId) fileId = record.mobileId;
    else if (record.thumbId) fileId = record.thumbId
    else fileId = record.originalId
  }

  const fileDoc = (await filesCollection.findOne({ _id: fileId })) as GridFsFileDoc | null;
  if (!fileDoc) {
    return jsonError(404, 'Media not found');
  }

  const downloadStream = openDownloadStreamById(fileId);

  const headers = new Headers({
    'Content-Type': fileDoc.contentType ?? 'application/octet-stream',
    'Cache-Control': 'public, max-age=31536000, immutable',
  });

  const filename = fileDoc.filename ?? fileId.toString();
  if (req.nextUrl.searchParams.get('download')) {
    headers.set('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
  }

  const readable = nodeStreamToReadable(downloadStream);
  return new NextResponse(readable, {
    headers,
  });
}

export async function DELETE(
  req: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  const { id } = await context.params;

  if (!Types.ObjectId.isValid(id)) {
    return jsonError(400, 'Invalid media identifier');
  }

  try {
    await requirePermission(req, 'media:write');
  } catch (err) {
    if (err instanceof HttpError) {
      return jsonError(err.status, err.message);
    }
    console.error('Failed to verify media delete permission', err);
    return jsonError(500, 'Failed to verify permissions');
  }

  await connectMongoose();

  const mediaId = new Types.ObjectId(id);
  const record = await MediaModel.findById(mediaId).exec();
  if (!record) {
    return jsonError(404, 'Media not found');
  }

  const bucket = getBucket();

  const fileIds = [record.originalId, record.mobileId, record.thumbId].filter(
    (value): value is Types.ObjectId => Boolean(value),
  );

  for (const fileId of fileIds) {
    try {
      await bucket.delete(fileId);
    } catch (err) {
      console.error('Failed to delete GridFS file', fileId.toString(), err);
    }
  }

  await MediaModel.deleteOne({ _id: record._id });

  if (record.scope === 'avatar' && record.ownerUserId) {
    await UserModel.updateOne(
      { _id: record.ownerUserId, 'avatar.groupId': record.groupId },
      { $unset: { avatar: 1 } },
    ).exec();
  }

  return NextResponse.json({ success: true });
}
