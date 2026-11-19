import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Types } from 'mongoose';
import { connectMongoose } from '@/lib/mongoose';
import { zObjectIdString, zSeo, zSlug, zStringNonEmpty } from '@/lib/z';
import type { BlogCategoryDocument } from '@/content/models/BlogCategory';
import {
  deleteCategory,
  getCategoryWithBreadcrumb,
  updateCategory,
} from '@/content/services/categoryService';

const paramsSchema = z.object({ id: zObjectIdString });

const updateSchema = z
  .object({
    name: zStringNonEmpty.optional(),
    slug: zSlug.optional(),
    parentId: zObjectIdString.nullable().optional(),
    position: z.number().int().optional(),
    isActive: z.boolean().optional(),
    seo: zSeo.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'No fields to update' });

type CategorySeo = NonNullable<BlogCategoryDocument['seo']>;

function mapSeo(input?: z.infer<typeof zSeo>): CategorySeo | undefined {
  if (!input) return undefined;
  const { ogImageId, ...rest } = input;
  const seo: CategorySeo = {
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
  const data = await getCategoryWithBreadcrumb(parse.data.id);
  if (!data) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  return NextResponse.json({ data });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const params = await context.params;
  await connectMongoose();
  const parseParams = paramsSchema.safeParse(params);
  if (!parseParams.success) {
    return NextResponse.json({ error: parseParams.error.flatten() }, { status: 400 });
  }
  try {
    const body = await request.json();
    const parsed = updateSchema.parse(body);
    await updateCategory(parseParams.data.id, {
      name: parsed.name,
      slug: parsed.slug,
      parentId: parsed.parentId ?? undefined,
      position: parsed.position,
      isActive: parsed.isActive,
      seo: mapSeo(parsed.seo),
    });
    const refreshed = await getCategoryWithBreadcrumb(parseParams.data.id);
    return NextResponse.json({ data: refreshed });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    if (error instanceof Error && error.message === 'category_not_found') {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    const mongoError = error as { code?: number };
    if (mongoError?.code === 11000) {
      return NextResponse.json({ error: 'duplicate_slug' }, { status: 409 });
    }
    console.error('Failed to update category', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const params = await context.params;
  await connectMongoose();
  const parse = paramsSchema.safeParse(params);
  if (!parse.success) {
    return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });
  }
  try {
    await deleteCategory(parse.data.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'category_has_children') {
        return NextResponse.json({ error: 'category_has_children' }, { status: 409 });
      }
      if (error.message === 'category_in_use') {
        return NextResponse.json({ error: 'category_in_use' }, { status: 409 });
      }
    }
    console.error('Failed to delete category', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
