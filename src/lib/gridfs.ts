import { Readable } from 'node:stream';
import mongoose, { Types } from 'mongoose';
import sharp from 'sharp';
import type { GridFSBucket, GridFSBucketReadStream } from 'mongodb';
import { ALLOWED_IMAGE_MIME_SET } from './media-constants';

const GRIDFS_BUCKET_NAME = 'fs';

const globalWithBucket = globalThis as typeof globalThis & {
  __gridfsBucket?: GridFSBucket;
};

function ensureBucket(): GridFSBucket {
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('Mongoose connection is not ready');
  }

  if (!globalWithBucket.__gridfsBucket) {
    globalWithBucket.__gridfsBucket = new mongoose.mongo.GridFSBucket(db, {
      bucketName: GRIDFS_BUCKET_NAME,
    });
  }

  return globalWithBucket.__gridfsBucket;
}

/**
 * Returns the singleton GridFS bucket instance.
 */
export function getBucket(): GridFSBucket {
  return ensureBucket();
}

/**
 * Uploads a Buffer to GridFS and resolves with the created ObjectId.
 */
export async function uploadBufferToGridFS(
  buffer: Buffer,
  filename: string,
  contentType: string,
  metadata?: Record<string, unknown>,
): Promise<Types.ObjectId> {
  const bucket = ensureBucket();
  const uploadStream = bucket.openUploadStream(filename, {
    contentType,
    metadata,
  });

  return new Promise<Types.ObjectId>((resolve, reject) => {
    Readable.from(buffer)
      .pipe(uploadStream)
      .on('error', reject)
      .on('finish', () => {
        resolve(uploadStream.id as Types.ObjectId);
      });
  });
}

export type ImageVariantResult = {
  groupId: Types.ObjectId;
  originalId: Types.ObjectId;
  mobileId: Types.ObjectId;
  thumbId: Types.ObjectId;
};

/**
 * Creates and stores original/mobile/thumb variants for an image upload.
 */
/**
 * Compress a sharp pipeline in the same family as the source content type, so a
 * normalized "original" keeps the format marketplaces/clients expect (jpeg/png)
 * while still being meaningfully smaller. mozjpeg + high-effort encoders.
 */
function encodeInSourceFormat(pipeline: sharp.Sharp, contentType: string): sharp.Sharp {
  switch (contentType) {
    case 'image/png':
      return pipeline.png({ compressionLevel: 9, palette: true });
    case 'image/webp':
      return pipeline.webp({ quality: 88 });
    case 'image/avif':
      return pipeline.avif({ quality: 60 });
    case 'image/jpeg':
    default:
      return pipeline.jpeg({ quality: 86, mozjpeg: true });
  }
}

export async function saveImageVariants(
  fileBuffer: Buffer,
  originalName: string,
  contentType: string,
  scope: string,
  ownerUserId?: Types.ObjectId,
): Promise<ImageVariantResult> {
  if (!ALLOWED_IMAGE_MIME_SET.has(contentType)) {
    throw new Error('Unsupported image MIME type');
  }

  const groupId = new Types.ObjectId();
  const ownerIdMeta = ownerUserId ? { ownerUserId } : undefined;

  // Normalize the "original": auto-rotate from EXIF, cap to 2200px and
  // re-encode/compress IN THE SOURCE FORMAT (so marketplace image uploads, which
  // expect jpeg/png, keep working). Storing the raw multi-megabyte camera file
  // bloated storage and made every full-size view download data that's never
  // used at the displayed size.
  const normalizedOriginal = await encodeInSourceFormat(
    sharp(fileBuffer)
      .rotate()
      .resize({ width: 2200, height: 2200, fit: 'inside', withoutEnlargement: true }),
    contentType,
  ).toBuffer();

  const originalId = await uploadBufferToGridFS(normalizedOriginal, originalName, contentType, {
    kind: 'original',
    groupId,
    scope,
    mediaKind: 'image',
    ...ownerIdMeta,
  });

  const mobileBuffer = await sharp(fileBuffer)
    .rotate()
    .resize({ width: 1280, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();

  const mobileId = await uploadBufferToGridFS(mobileBuffer, `${groupId.toString()}-mobile.webp`, 'image/webp', {
    kind: 'mobile',
    groupId,
    scope,
    mediaKind: 'image',
    ...ownerIdMeta,
  });

  const thumbBuffer = await sharp(fileBuffer)
    .rotate()
    .resize({ width: 320, height: 320, fit: 'cover', position: 'center' })
    .webp({ quality: 80 })
    .toBuffer();

  const thumbId = await uploadBufferToGridFS(thumbBuffer, `${groupId.toString()}-thumb.webp`, 'image/webp', {
    kind: 'thumb',
    groupId,
    scope,
    mediaKind: 'image',
    ...ownerIdMeta,
  });

  return {
    groupId,
    originalId,
    mobileId,
    thumbId,
  };
}

/**
 * Opens a readable stream for a GridFS file.
 */
export function openDownloadStreamById(id: Types.ObjectId): GridFSBucketReadStream {
  const bucket = ensureBucket();
  return bucket.openDownloadStream(id);
}
