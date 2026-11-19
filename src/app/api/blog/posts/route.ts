import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Types } from 'mongoose';
import { connectMongoose } from '@/lib/mongoose';
import { zObjectIdString, zSeo, zSlug, zStringNonEmpty } from '@/lib/z';
import type { BlogPostDocument } from '@/content/models/BlogPost';
import { createPost, listPosts } from '@/content/services/postService';
import { requirePermission } from '@/lib/auth';

const querySchema = z.object({
  q: z.string().optional(),
  categoryId: zObjectIdString.optional(),
  includeSubtree: z.enum(['true', 'false']).optional(),
  status: z.string().optional(),
  limit: z.coerce.number().int().positive().optional(),
  skip: z.coerce.number().int().min(0).optional(),
});

const createSchema = z.object({
  title: zStringNonEmpty,
  slug: zSlug,
  excerpt: z.string().optional(),
  content: z.string().min(1),
  coverImageId: zObjectIdString.optional(),
  categories: z.array(zObjectIdString).optional(),
  tags: z.array(z.string()).optional(),
  authorId: zObjectIdString.optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
  publishedAt: z.coerce.date().optional(),
  seo: zSeo.optional(),
});

type PostSeo = NonNullable<BlogPostDocument['seo']>;

function mapSeo(input?: z.infer<typeof zSeo>): PostSeo | undefined {
  if (!input) return undefined;
  const { ogImageId, ...rest } = input;
  const seo: PostSeo = {
    ...rest,
    ...(ogImageId ? { ogImageId: new Types.ObjectId(ogImageId) } : {}),
  };
  return seo;
}

export async function GET(request: NextRequest) {
  await connectMongoose();
  const url = new URL(request.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const statusFilters = parsed.data.status
    ? parsed.data.status
        .split(',')
        .map((item) => item.trim())
        .filter((item): item is BlogPostDocument['status'] =>
          ['draft', 'published', 'archived'].includes(item as BlogPostDocument['status'])
        )
    : undefined;

  const posts = await listPosts({
    q: parsed.data.q,
    categoryId: parsed.data.categoryId,
    includeSubtree: parsed.data.includeSubtree === 'true',
    status: statusFilters,
    limit: parsed.data.limit,
    skip: parsed.data.skip,
  });
  return NextResponse.json({ data: posts });
}

export async function POST(request: NextRequest) {
  await connectMongoose();
  await requirePermission(request, 'catalog:publish');
  try {
    const body = await request.json();
    const parsed = createSchema.parse(body);
    const post = await createPost({
      title: parsed.title,
      slug: parsed.slug,
      excerpt: parsed.excerpt,
      content: parsed.content,
      coverImageId: parsed.coverImageId,
      categories: parsed.categories,
      tags: parsed.tags,
      authorId: parsed.authorId,
      status: parsed.status,
      publishedAt: parsed.publishedAt,
      seo: mapSeo(parsed.seo),
    });
    return NextResponse.json({ data: post }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    const mongoError = error as { code?: number };
    if (mongoError?.code === 11000) {
      return NextResponse.json({ error: 'duplicate_slug' }, { status: 409 });
    }
    console.error('Failed to create post', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
