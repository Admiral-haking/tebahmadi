import { Types } from 'mongoose';
import { createImageRecord, assertImageMime } from '@/media/services/mediaService';
import MediaModel, { type MediaDocument } from '@/media/models/Media';
import { getBucket, saveImageVariants } from '@/lib/gridfs';

const MAX_SUPPORT_ATTACHMENT_BYTES = 8 * 1024 * 1024;

type UploadLike = Blob & {
  name?: string;
  type?: string;
  size?: number;
};

export class SupportAttachmentError extends Error {
  constructor(message: string, readonly status: 400 | 413 = 400) {
    super(message);
    this.name = 'SupportAttachmentError';
  }
}

function isUploadLike(value: unknown): value is UploadLike {
  return (
    typeof value === 'object' &&
    value !== null &&
    'arrayBuffer' in value &&
    typeof (value as { arrayBuffer?: unknown }).arrayBuffer === 'function'
  );
}

export async function saveSupportAttachment(
  value: unknown,
  ownerUserId?: Types.ObjectId,
): Promise<MediaDocument> {
  if (!isUploadLike(value)) {
    throw new Error('تصویر پیوست معتبر نیست.');
  }

  const contentType = typeof value.type === 'string' ? value.type : '';
  const fileName = typeof value.name === 'string' && value.name.trim() ? value.name.trim() : 'support-attachment';
  const declaredSize = typeof value.size === 'number' ? value.size : 0;
  if (!contentType.startsWith('image/')) {
    throw new SupportAttachmentError('فقط فایل تصویری برای پیوست پشتیبانی مجاز است.');
  }
  try {
    assertImageMime(contentType);
  } catch {
    throw new SupportAttachmentError('فرمت تصویر پیوست پشتیبانی مجاز نیست.');
  }
  if (declaredSize <= 0 || declaredSize > MAX_SUPPORT_ATTACHMENT_BYTES) {
    throw new SupportAttachmentError('حجم تصویر پیوست باید کمتر از ۸ مگابایت باشد.', 413);
  }

  const buffer = Buffer.from(await value.arrayBuffer());
  if (buffer.byteLength === 0 || buffer.byteLength > MAX_SUPPORT_ATTACHMENT_BYTES) {
    throw new SupportAttachmentError('حجم تصویر پیوست باید کمتر از ۸ مگابایت باشد.', 413);
  }

  const variants = await saveImageVariants(buffer, fileName, contentType, 'attachment', ownerUserId);
  return createImageRecord({
    filename: fileName,
    contentType,
    variants,
    scope: 'attachment',
    ownerUserId,
  });
}

export async function removeSupportAttachment(media: MediaDocument): Promise<void> {
  const bucket = getBucket();
  const fileIds = [media.originalId, media.mobileId, media.thumbId].filter(
    (value): value is Types.ObjectId => Boolean(value),
  );

  await Promise.all(fileIds.map(async (fileId) => {
    try {
      await bucket.delete(fileId);
    } catch (error) {
      console.error('Failed to delete support attachment file', fileId.toString(), error);
    }
  }));
  await MediaModel.deleteOne({ _id: media._id }).exec();
}
