import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Types } from 'mongoose';
import { connectMongoose } from '@/lib/mongoose';
import { getPageById, softDeletePage, updatePage } from '@/content/services/pageService';
import type { PageDocument } from '@/content/models/Page';
import { zObjectIdString, zSeo, zSlug, zStatus, zStringNonEmpty } from '@/lib/z';
import { requirePermission } from '@/lib/auth';

const paramsSchema = z.object({ id: zObjectIdString });

const updateSchema = z.object({
  title: zStringNonEmpty.optional(),
  slug: zSlug.optional(),
  content: z.string().optional(),
  status: zStatus.optional(),
  publishedAt: z.coerce.date().optional(),
  seo: zSeo.optional(),
});

type PageSeo = NonNullable<PageDocument['seo']>;

function mapSeo(input?: z.infer<typeof zSeo>): PageSeo | undefined {
  if (!input) return undefined;
  const { ogImageId, ...rest } = input;
  const seo: PageSeo = {
    ...rest,
    ...(ogImageId ? { ogImageId: new Types.ObjectId(ogImageId) } : {}),
  };
  return seo;
}

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const params = await context.params;
  await connectMongoose();
  const parse = paramsSchema.safeParse(params);
  if (!parse.success) {
    return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });
  }
  const page = await getPageById(parse.data.id);
  if (!page) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  return NextResponse.json({ data: page });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const params = await context.params;
  await connectMongoose();
  await requirePermission(request, 'catalog:publish');
  const parseParams = paramsSchema.safeParse(params);
  if (!parseParams.success) {
    return NextResponse.json({ error: parseParams.error.flatten() }, { status: 400 });
  }
  try {
    const body = await request.json();
    const parsed = updateSchema.parse(body);
    const page = await updatePage(parseParams.data.id, {
      ...parsed,
      seo: mapSeo(parsed.seo),
    });
    return NextResponse.json({ data: page });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    if (error instanceof Error && error.message === 'page_not_found') {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    const mongoError = error as { code?: number };
    if (mongoError?.code === 11000) {
      return NextResponse.json({ error: 'duplicate_slug' }, { status: 409 });
    }
    console.error('Failed to update page', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const params = await context.params;
  await connectMongoose();
  await requirePermission(request, 'catalog:publish');
  const parse = paramsSchema.safeParse(params);
  if (!parse.success) {
    return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });
  }
  await softDeletePage(parse.data.id);
  return NextResponse.json({ ok: true });
}
