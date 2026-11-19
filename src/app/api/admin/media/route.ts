import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';

import { connectMongoose } from '@/lib/mongoose';
import { listMediaAdmin } from '@/media/services/mediaService';
import type { MediaFilterState, MediaListItem } from '@/views/admin/media/types';
import { jsonError } from '@/lib/http';

const PAGE_SIZE = 24;

const MEDIA_SCOPES = new Set(['avatar', 'attachment', 'gallery']);
const MEDIA_KINDS = new Set(['image', 'file']);

function normalizePage(input?: number): number {
  if (!input || Number.isNaN(input) || input < 1) {
    return 1;
  }
  return Math.floor(input);
}

function normalizeScope(input?: string): MediaFilterState['scope'] {
  if (!input) {
    return 'all';
  }
  return MEDIA_SCOPES.has(input as any) ? (input as MediaFilterState['scope']) : 'all';
}

function normalizeKind(input?: string): MediaFilterState['kind'] {
  if (!input) {
    return 'all';
  }
  return MEDIA_KINDS.has(input as any) ? (input as MediaFilterState['kind']) : 'all';
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    await connectMongoose();
    const params = req.nextUrl.searchParams;

    const pageParam = Number.parseInt(params.get('page') ?? '1', 10);
    const q = params.get('q') ?? undefined;
    const scope = params.get('scope') ?? undefined;
    const kind = params.get('kind') ?? undefined;
    const owner = params.get('owner') ?? undefined;

    const normalizedPage = normalizePage(pageParam);
    const normalizedScope = normalizeScope(scope);
    const normalizedKind = normalizeKind(kind);
    const ownerRaw = owner?.trim() ?? '';
    const searchQuery = q?.trim() ?? '';

    const ownerObjectId =
      ownerRaw && Types.ObjectId.isValid(ownerRaw) ? new Types.ObjectId(ownerRaw) : undefined;

    const listResult = await listMediaAdmin({
      page: normalizedPage,
      limit: PAGE_SIZE,
      scope: normalizedScope === 'all' ? undefined : normalizedScope,
      kind: normalizedKind === 'all' ? undefined : normalizedKind,
      ownerUserId: ownerObjectId,
      search: searchQuery || undefined,
    });

    const items: MediaListItem[] = listResult.items.map((item) => ({
      id: item._id ?? item.id,
      groupId: item.groupId,
      kind: item.kind,
      scope: item.scope,
      filename: item.filename,
      contentType: item.contentType,
      originalId: item.originalId,
      mobileId: item.mobileId ?? undefined,
      thumbId: item.thumbId ?? undefined,
      ownerUserId: item.ownerUserId ?? undefined,
      createdAt: item.createdAt ? new Date(item.createdAt).toISOString() : undefined,
      updatedAt: item.updatedAt ? new Date(item.updatedAt).toISOString() : undefined,
    }));

    const filterState: MediaFilterState = {
      scope: normalizedScope,
      kind: normalizedKind,
      q: searchQuery,
      owner: ownerRaw,
    };

    return NextResponse.json({
      items,
      filters: filterState,
      page: listResult.page,
      pages: listResult.pages,
      total: listResult.total,
      pageSize: PAGE_SIZE,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load media library';
    return jsonError(500, message);
  }
}
