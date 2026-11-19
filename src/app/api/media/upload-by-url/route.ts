import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { connectMongoose } from '@/lib/mongoose';
import { jsonError } from '@/lib/http';
import { mediaScopeSchema } from '@/lib/schemas';
import { getAuth, requirePermission } from '@/lib/auth';
import { assertImageMime, createFileRecord, createImageRecord } from '@/media/services/mediaService';
import { saveImageVariants, uploadBufferToGridFS } from '@/lib/gridfs';
import UserModel from '@/models/User';

const MAX_DOWNLOAD_BYTES = 20 * 1024 * 1024;
const DOWNLOAD_TIMEOUT_MS = 30000;
const DOWNLOAD_RETRIES = 1;

export const runtime = 'nodejs';

/**
 * Fetch the source image with a generous timeout and one retry. Marketplace /
 * CDN image hosts are often slow or briefly unreachable from the server, so a
 * single 15s attempt aborted constantly ("This operation was aborted"). Retrying
 * once on a timeout/network error recovers most of those.
 */
async function fetchImageWithRetry(url: string): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= DOWNLOAD_RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'image/webp,image/avif,image/jpeg,image/png,*/*',
        },
      });
      return response;
    } catch (err) {
      lastError = err;
      if (attempt < DOWNLOAD_RETRIES) {
        await new Promise((r) => setTimeout(r, 800));
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }
  throw lastError;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  await connectMongoose();
  await requirePermission(req, 'media:write');

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

  const imageUrl = formData.get('url');
  const imageUrlStr = typeof imageUrl === 'string' ? imageUrl.trim() : '';

  if (!imageUrlStr) {
    return jsonError(400, 'Image URL is required');
  }

  try {
    new URL(imageUrlStr);
  } catch {
    return jsonError(400, 'Invalid URL format');
  }

  try {
    const response = await fetchImageWithRetry(imageUrlStr);

    if (!response.ok) {
      return jsonError(400, `Failed to download image: HTTP ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length === 0) {
      return jsonError(400, 'Downloaded image is empty');
    }

    if (buffer.length > MAX_DOWNLOAD_BYTES) {
      return jsonError(413, 'Downloaded image exceeds size limit');
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    
    const urlObj = new URL(imageUrlStr);
    let filename = urlObj.pathname.split('/').pop() || 'downloaded-image';
    if (!filename.includes('.')) filename = `${filename}.jpg`;
    filename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');

    let mediaResponse: unknown;

    if (contentType.startsWith('image/')) {
      assertImageMime(contentType);
      const variants = await saveImageVariants(buffer, filename, contentType, scope, ownerUserId);
      const mediaDoc = await createImageRecord({
        filename,
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
      const fileId = await uploadBufferToGridFS(buffer, filename, contentType, {
        kind: 'original',
        scope,
        mediaKind: 'file',
        groupId,
        ownerUserId,
      });
      const mediaDoc = await createFileRecord({
        filename,
        contentType,
        fileId,
        scope,
        ownerUserId,
        groupId,
      });
      mediaResponse = mediaDoc.toJSON();
    }

    return NextResponse.json({ media: mediaResponse });
  } catch (err: any) {
    // A timed-out/aborted source download is an expected transient condition
    // (slow CDN), not a system error — log it at warn so it doesn't look like a
    // failure of ours.
    if (err?.name === 'AbortError') {
      console.warn('Upload by URL: source download timed out', imageUrlStr);
      return jsonError(408, 'Download timed out');
    }
    console.error('Upload by URL failed', err?.message || err);
    if (err instanceof Error) {
      return jsonError(400, err.message);
    }
    return jsonError(500, 'Unexpected error while processing upload');
  }
}
