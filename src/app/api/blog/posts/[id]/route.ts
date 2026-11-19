import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Types } from 'mongoose';
import { connectMongoose } from '@/lib/mongoose';
import { zObjectIdString, zSeo, zSlug, zStringNonEmpty } from '@/lib/z';
import type { BlogPostDocument } from '@/content/models/BlogPost';
import { getPostById, softDeletePost, updatePost } from '@/content/services/postService';

const paramsSchema = z.object({ id: zObjectIdString });

const updateSchema = z.object({
  title: zStringNonEmpty.optional(),
  slug: zSlug.optional(),
  excerpt: z.string().optional(),
  content: z.string().optional(),
  coverImageId: zObjectIdString.nullable().optional(),
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

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const params = await context.params;
  await connectMongoose();
  const parse = paramsSchema.safeParse(params);
  if (!parse.success) {
    return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });
  }
  const post = await getPostById(parse.data.id);
  if (!post) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  return NextResponse.json({ data: post });
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
    const updatePayload = {
      ...parsed,
      coverImageId: parsed.coverImageId ?? undefined,
      seo: mapSeo(parsed.seo),
    };
    const post = await updatePost(parseParams.data.id, updatePayload);
    return NextResponse.json({ data: post });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    if (error instanceof Error && error.message === 'post_not_found') {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    const mongoError = error as { code?: number };
    if (mongoError?.code === 11000) {
      return NextResponse.json({ error: 'duplicate_slug' }, { status: 409 });
    }
    console.error('Failed to update post', error);
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
  await softDeletePost(parse.data.id);
  return NextResponse.json({ ok: true });
}
