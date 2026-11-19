import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { connectMongoose } from '@/lib/mongoose';
import { jsonError } from '@/lib/http';
import { mediaScopeSchema } from '@/lib/schemas';
import { getAuth, HttpError, requirePermission } from '@/lib/auth';
import { assertImageMime, createFileRecord, createImageRecord } from '@/media/services/mediaService';
import { saveImageVariants, uploadBufferToGridFS } from '@/lib/gridfs';
import UserModel from '@/models/User';

const MAX_UPLOAD_MB = 50;
const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

export const runtime = 'nodejs';

type UploadLike = Blob & {
  name?: string;
  type?: string;
  size?: number;
};

function isUploadLike(value: unknown): value is UploadLike {
  return (
    typeof value === 'object' &&
    value !== null &&
    'arrayBuffer' in value &&
    typeof (value as { arrayBuffer?: unknown }).arrayBuffer === 'function'
  );
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  await connectMongoose();

  try {
    await requirePermission(req, 'media:write');
  } catch (err) {
    if (err instanceof HttpError) {
      return jsonError(err.status, err.message);
    }
    console.error('Failed to verify media upload permission', err);
    return jsonError(500, 'Failed to verify permissions');
  }

  const auth = getAuth(req);
  const ownerUserId = auth && Types.ObjectId.isValid(auth.sub) ? new Types.ObjectId(auth.sub) : undefined;

  const searchScope = req.nextUrl.searchParams.get('scope');
  const formData = await req.formData();
  const formScopeValue = formData.get('scope');
  const scopeInput = (searchScope ?? (typeof formScopeValue === 'string' ? formScopeValue : undefined) ?? 'gallery').toString();
  const parsedScope = mediaScopeSchema.safeParse(scopeInput);
  if (!parsedScope.success) {
    return jsonError(400, 'Invalid media scope');
  }
  const scope = parsedScope.data;

  if (scope === 'avatar' && !ownerUserId) {
    return jsonError(401, 'Authentication required for avatar uploads');
  }

  const filePart = formData.get('file');
  if (!isUploadLike(filePart)) {
    return jsonError(400, 'File is required');
  }

  const fileName = typeof filePart.name === 'string' && filePart.name.trim() ? filePart.name : 'upload';
  const contentType = typeof filePart.type === 'string' && filePart.type ? filePart.type : 'application/octet-stream';
  const declaredSize = typeof filePart.size === 'number' ? filePart.size : 0;

  if (declaredSize === 0) {
    return jsonError(400, 'Uploaded file is empty');
  }

  if (declaredSize > MAX_UPLOAD_BYTES) {
    return jsonError(413, 'Uploaded file exceeds size limit (' + MAX_UPLOAD_MB + 'MB)');
  }

  const arrayBuffer = await filePart.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (buffer.byteLength === 0) {
    return jsonError(400, 'Uploaded file is empty');
  }

  if (buffer.byteLength > MAX_UPLOAD_BYTES) {
    return jsonError(413, 'Uploaded file exceeds size limit (' + MAX_UPLOAD_MB + 'MB)');
  }

  let mediaResponse: unknown;

  try {
    if (contentType.startsWith('image/')) {
      assertImageMime(contentType);
      const variants = await saveImageVariants(buffer, fileName, contentType, scope, ownerUserId);
      const mediaDoc = await createImageRecord({
        filename: fileName,
        contentType,
        variants,
        scope,
        ownerUserId,
      });
      mediaResponse = mediaDoc.toJSON();

      if (scope === 'avatar' && ownerUserId) {
        await UserModel.findByIdAndUpdate(ownerUserId, {
          avatar: {
            originalId: variants.originalId,
            mobileId: variants.mobileId,
            thumbId: variants.thumbId,
            groupId: variants.groupId,
          },
        }).exec();
      }
    } else {
      const groupId = new Types.ObjectId();
      const fileId = await uploadBufferToGridFS(buffer, fileName, contentType, {
        kind: 'original',
        scope,
        mediaKind: 'file',
        groupId,
        ownerUserId,
      });
      const mediaDoc = await createFileRecord({
        filename: fileName,
        contentType,
        fileId,
        scope,
        ownerUserId,
        groupId,
      });
      mediaResponse = mediaDoc.toJSON();
    }
  } catch (err) {
    console.error('Upload failed', err);
    if (err instanceof Error) {
      return jsonError(400, err.message);
    }
    return jsonError(500, 'Unexpected error while processing upload');
  }

  return NextResponse.json({ media: mediaResponse });
}
