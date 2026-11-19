import { Types } from 'mongoose';
import MediaModel, { type MediaDocument, type MediaLean } from '@/media/models/Media';
import type { MediaKind, MediaScope } from '@/types';
import type { ImageVariantResult } from '@/lib/gridfs';
import { ALLOWED_IMAGE_MIME_SET } from '@/lib/media-constants';

export function assertImageMime(contentType: string): void {
  if (!ALLOWED_IMAGE_MIME_SET.has(contentType)) {
    throw new Error('Unsupported image MIME type');
  }
}

type ImageRecordInput = {
  filename: string;
  contentType: string;
  variants: ImageVariantResult;
  scope: MediaScope;
  ownerUserId?: Types.ObjectId;
};

type FileRecordInput = {
  filename: string;
  contentType: string;
  fileId: Types.ObjectId;
  scope: MediaScope;
  ownerUserId?: Types.ObjectId;
  groupId?: Types.ObjectId;
};

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function toMediaLean(doc: MediaDocument): MediaLean {
  return doc.toJSON() as unknown as MediaLean;
}

export async function createImageRecord({
  filename,
  contentType,
  variants,
  scope,
  ownerUserId,
}: ImageRecordInput): Promise<MediaDocument> {
  const media = await MediaModel.create({
    groupId: variants.groupId,
    kind: 'image',
    scope,
    originalId: variants.originalId,
    mobileId: variants.mobileId,
    thumbId: variants.thumbId,
    filename,
    contentType,
    ownerUserId,
  });

  return media;
}

export async function createFileRecord({
  filename,
  contentType,
  fileId,
  scope,
  ownerUserId,
  groupId,
}: FileRecordInput): Promise<MediaDocument> {
  const resolvedGroupId = groupId ?? new Types.ObjectId();
  const media = await MediaModel.create({
    groupId: resolvedGroupId,
    kind: 'file',
    scope,
    originalId: fileId,
    filename,
    contentType,
    ownerUserId,
  });

  return media;
}

type PaginationOptions = {
  limit?: number;
  cursor?: string;
};

export async function listGalleryForUser(
  userId: Types.ObjectId,
  { limit = DEFAULT_LIMIT, cursor }: PaginationOptions = {},
): Promise<{ items: MediaLean[]; nextCursor: string | null }> {
  const normalizedLimit = Math.min(Math.max(limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
  const query: Record<string, unknown> = {
    scope: 'gallery',
    ownerUserId: userId,
  };

  if (cursor) {
    query._id = { $lt: new Types.ObjectId(cursor) };
  }

  const docs = await MediaModel.find(query)
    .sort({ _id: -1 })
    .limit(normalizedLimit + 1)
    .exec();

  let nextCursor: string | null = null;
  if (docs.length > normalizedLimit) {
    const nextDoc = docs[normalizedLimit];
    nextCursor = nextDoc._id.toString();
  }

  const items = docs.slice(0, normalizedLimit).map((doc) => toMediaLean(doc));
  return { items, nextCursor };
}

type EscapeRegExp = (input: string) => string;

const escapeRegExp: EscapeRegExp = (input) => input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

type ListMediaAdminOptions = {
  page?: number;
  limit?: number;
  scope?: MediaScope | 'all';
  kind?: MediaKind;
  ownerUserId?: Types.ObjectId;
  search?: string;
};

export async function listMediaAdmin({
  page = 1,
  limit = DEFAULT_LIMIT,
  scope,
  kind,
  ownerUserId,
  search,
}: ListMediaAdminOptions = {}): Promise<{
  items: MediaLean[];
  total: number;
  pages: number;
  page: number;
}> {
  const normalizedLimit = Math.min(Math.max(limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
  const normalizedPage = Math.max(page ?? 1, 1);

  const filter: Record<string, unknown> = {};

  if (scope && scope !== 'all') {
    filter.scope = scope;
  }

  if (kind) {
    filter.kind = kind;
  }

  if (ownerUserId) {
    filter.ownerUserId = ownerUserId;
  }

  if (search && search.trim()) {
    const escaped = escapeRegExp(search.trim());
    filter.filename = new RegExp(escaped, 'i');
  }

  const [docs, total] = await Promise.all([
    MediaModel.find(filter)
      .sort({ createdAt: -1 })
      .skip((normalizedPage - 1) * normalizedLimit)
      .limit(normalizedLimit)
      .exec(),
    MediaModel.countDocuments(filter),
  ]);

  const items = docs.map((doc) => toMediaLean(doc));
  const pages = total > 0 ? Math.ceil(total / normalizedLimit) : 0;

  return {
    items,
    total,
    pages,
    page: normalizedPage,
  };
}

export async function listGalleryAll(
  { limit = DEFAULT_LIMIT, cursor }: PaginationOptions = {},
): Promise<{ items: MediaLean[]; nextCursor: string | null }> {
  const normalizedLimit = Math.min(Math.max(limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
  const query: Record<string, unknown> = {
    scope: 'gallery',
  };

  if (cursor) {
    query._id = { $lt: new Types.ObjectId(cursor) };
  }

  const docs = await MediaModel.find(query)
    .sort({ _id: -1 })
    .limit(normalizedLimit + 1)
    .exec();

  let nextCursor: string | null = null;
  if (docs.length > normalizedLimit) {
    const nextDoc = docs[normalizedLimit];
    nextCursor = nextDoc._id.toString();
  }

  const items = docs.slice(0, normalizedLimit).map((doc) => toMediaLean(doc));
  return { items, nextCursor };
}
