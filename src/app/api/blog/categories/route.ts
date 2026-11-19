import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Types } from 'mongoose';
import { connectMongoose } from '@/lib/mongoose';
import { zObjectIdString, zSeo, zSlug, zStringNonEmpty } from '@/lib/z';
import type { BlogCategoryDocument } from '@/content/models/BlogCategory';
import { createCategory, listCategories } from '@/content/services/categoryService';
import { requirePermission } from '@/lib/auth';

const querySchema = z.object({ parentId: zObjectIdString.optional() });

const createSchema = z.object({
  name: zStringNonEmpty,
  slug: zSlug,
  parentId: zObjectIdString.nullable().optional(),
  position: z.number().int().optional(),
  isActive: z.boolean().optional(),
  seo: zSeo.optional(),
});

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

export async function GET(request: NextRequest) {
  await connectMongoose();
  const url = new URL(request.url);
  const parse = querySchema.partial().safeParse(Object.fromEntries(url.searchParams));
  if (!parse.success) {
    return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });
  }

  const categories = await listCategories(parse.data.parentId ?? null);
  return NextResponse.json({ data: categories });
}

export async function POST(request: NextRequest) {
  await connectMongoose();
  await requirePermission(request, 'catalog:publish');
  try {
    const body = await request.json();
    const parsed = createSchema.parse(body);
    const category = await createCategory({
      name: parsed.name,
      slug: parsed.slug,
      parentId: parsed.parentId ?? null,
      position: parsed.position,
      isActive: parsed.isActive,
      seo: mapSeo(parsed.seo),
    });
    return NextResponse.json({ data: category }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    const mongoError = error as { code?: number };
    if (mongoError?.code === 11000) {
      return NextResponse.json({ error: 'duplicate_slug' }, { status: 409 });
    }
    console.error('Failed to create category', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
