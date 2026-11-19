import { NextRequest, NextResponse } from 'next/server';

import { BlogCategoryModel } from '@/content/models/BlogCategory';
import { BlogPostModel } from '@/content/models/BlogPost';
import { connectMongoose } from '@/lib/mongoose';
import { jsonError } from '@/lib/http';

type BlogCategoryListItem = {
  id: string;
  name: string;
  slug: string;
  path: string;
  depth: number;
  parentId?: string | null;
  isActive: boolean;
  position?: number;
  childCount: number;
  postCount: number;
  updatedAt?: string;
};

function buildFilter(q?: string | null): Record<string, unknown> {
  if (!q) {
    return {};
  }
  const trimmed = q.trim();
  if (!trimmed) {
    return {};
  }
  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(escaped, 'i');
  return {
    $or: [{ name: regex }, { slug: regex }, { path: regex }],
  };
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    await connectMongoose();
    const params = req.nextUrl.searchParams;
    const q = params.get('q');

    const filter = buildFilter(q);

    const [categories, postBuckets] = await Promise.all([
      BlogCategoryModel.find(filter).sort({ depth: 1, position: 1, name: 1 }).lean(),
      BlogPostModel.aggregate<{ _id: unknown; count: number }>([
        { $unwind: { path: '$categories', preserveNullAndEmptyArrays: false } },
        { $group: { _id: '$categories', count: { $sum: 1 } } },
      ]),
    ]);

    const childCountMap = new Map<string, number>();
    categories.forEach((category) => {
      const parent = category.parentId ? category.parentId.toString() : null;
      if (!parent) return;
      childCountMap.set(parent, (childCountMap.get(parent) ?? 0) + 1);
    });

    const postCountMap = new Map<string, number>(
      postBuckets.map((bucket) => [String(bucket._id), bucket.count]),
    );

    const list: BlogCategoryListItem[] = categories.map((category) => {
      const id = category._id.toString();
      return {
        id,
        name: category.name,
        slug: category.slug,
        path: category.path,
        depth: category.depth ?? 0,
        parentId: category.parentId ? category.parentId.toString() : null,
        isActive: category.isActive ?? true,
        position: category.position ?? undefined,
        childCount: childCountMap.get(id) ?? 0,
        postCount: postCountMap.get(id) ?? 0,
        updatedAt: category.updatedAt ? category.updatedAt.toISOString() : undefined,
      };
    });

    return NextResponse.json({ categories: list });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load blog categories';
    return jsonError(500, message);
  }
}
