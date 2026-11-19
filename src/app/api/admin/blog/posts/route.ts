import { NextRequest, NextResponse } from 'next/server';
import { FilterQuery, Types } from 'mongoose';

import { connectMongoose } from '@/lib/mongoose';
import { BlogPostModel, type BlogPostDocument } from '@/content/models/BlogPost';
import { BlogCategoryModel } from '@/content/models/BlogCategory';
import { subtreeIds } from '@/content/services/categoryService';
import { jsonError } from '@/lib/http';

const PAGE_SIZE = 15;

type BlogPostStatus = BlogPostDocument['status'];

type BlogCategoryFilterOption = {
  id: string;
  name: string;
  path: string;
  depth: number;
};

type BlogPostListItem = {
  id: string;
  title: string;
  slug: string;
  status: BlogPostStatus;
  excerpt?: string | null;
  categories: Array<{ id: string; name: string; path: string }>;
  tags: string[];
  coverImageId?: string;
  authorId?: string;
  publishedAt?: string | null;
  updatedAt?: string | null;
  createdAt?: string | null;
};

function normalizePage(input?: number): number {
  if (!input || Number.isNaN(input) || input < 1) {
    return 1;
  }
  return Math.floor(input);
}

function mapStatusBuckets(
  buckets: Array<{ _id: string; count: number }>,
): Record<BlogPostStatus, number> {
  const base: Record<BlogPostStatus, number> = {
    draft: 0,
    published: 0,
    archived: 0,
  };
  buckets.forEach((bucket) => {
    const status = bucket._id as BlogPostStatus;
    if (status in base) {
      base[status] = bucket.count;
    }
  });
  return base;
}

function parseStatuses(value: string | null): BlogPostStatus[] | undefined {
  if (!value) return undefined;
  const parts = value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  if (parts.length === 0) return undefined;
  return parts.filter((item): item is BlogPostStatus =>
    item === 'draft' || item === 'published' || item === 'archived',
  );
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    await connectMongoose();
    const params = req.nextUrl.searchParams;

    const pageParam = Number.parseInt(params.get('page') ?? '1', 10);
    const q = params.get('q') ?? undefined;
    const statusParam = parseStatuses(params.get('status'));
    const categoryId = params.get('category') ?? undefined;
    const includeSubtree = params.get('subtree') === '1';

    const normalizedPage = normalizePage(pageParam);
    const skip = (normalizedPage - 1) * PAGE_SIZE;

    const [categoryDocs, categoryTreeIds] = await Promise.all([
      BlogCategoryModel.find({}, { name: 1, path: 1, depth: 1 })
        .sort({ path: 1 })
        .lean(),
      categoryId && includeSubtree ? subtreeIds(categoryId) : Promise.resolve(null),
    ]);

    const categoryOptions: BlogCategoryFilterOption[] = categoryDocs.map((category) => ({
      id: category._id.toString(),
      name: category.name ?? '-',
      path: category.path ?? '-',
      depth: category.depth ?? 0,
    }));

    const categoryMap = new Map<string, { name: string; path: string }>(
      categoryOptions.map((item) => [item.id, { name: item.name, path: item.path }]),
    );

    const filter: FilterQuery<BlogPostDocument> = {};

    if (statusParam && statusParam.length > 0) {
      filter.status = { $in: statusParam };
    }

    if (q && q.trim()) {
      filter.$text = { $search: q.trim() } as FilterQuery<BlogPostDocument>['$text'];
    }

    if (categoryId) {
      const ids = categoryTreeIds ?? [categoryId];
      filter.categories = {
        $in: ids.map((id) => new Types.ObjectId(id)),
      };
    }

    const projection: Record<string, unknown> = {
      title: 1,
      slug: 1,
      status: 1,
      excerpt: 1,
      categories: 1,
      tags: 1,
      coverImageId: 1,
      authorId: 1,
      publishedAt: 1,
      updatedAt: 1,
      createdAt: 1,
    };

    if (filter.$text) {
      projection.score = { $meta: 'textScore' };
    }

    const sort = filter.$text
      ? { score: { $meta: 'textScore' }, publishedAt: -1, createdAt: -1 }
      : { publishedAt: -1, createdAt: -1 };

    const postsQuery = BlogPostModel.find(filter)
      .sort(sort as any)
      .skip(skip)
      .limit(PAGE_SIZE)
      .select(projection as any)
      .lean();

    const filterForStatusBuckets: FilterQuery<BlogPostDocument> = { ...filter };
    delete filterForStatusBuckets.status;

    const [posts, total, statusBuckets] = await Promise.all([
      postsQuery,
      BlogPostModel.countDocuments(filter),
      BlogPostModel.aggregate<{ _id: string; count: number }>([
        { $match: filterForStatusBuckets },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
    ]);

    const items: BlogPostListItem[] = posts.map((post) => {
      const categories = Array.isArray(post.categories)
        ? post.categories
            .map((category) => {
              const id =
                typeof category === 'string'
                  ? category
                  : category?.toString?.() ?? '';
              if (!id) return null;
              const meta = categoryMap.get(id);
              return meta ? { id, name: meta.name, path: meta.path } : { id, name: '-', path: '-' };
            })
            .filter(
              (item): item is { id: string; name: string; path: string } => Boolean(item),
            )
        : [];

      return {
        id: post._id.toString(),
        title: post.title,
        slug: post.slug,
        status: post.status,
        excerpt: post.excerpt ?? null,
        categories,
        tags: Array.isArray(post.tags) ? post.tags : [],
        coverImageId: post.coverImageId ? post.coverImageId.toString() : undefined,
        authorId: post.authorId ? post.authorId.toString() : undefined,
        publishedAt: post.publishedAt ? post.publishedAt.toISOString() : null,
        updatedAt: post.updatedAt ? post.updatedAt.toISOString() : null,
        createdAt: post.createdAt ? post.createdAt.toISOString() : null,
      };
    });

    const totalPages = total > 0 ? Math.max(1, Math.ceil(total / PAGE_SIZE)) : 1;
    const statusCounts = mapStatusBuckets(statusBuckets);

    return NextResponse.json({
      posts: items,
      total,
      page: normalizedPage,
      pages: totalPages,
      statusCounts,
      categoryOptions,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load blog posts';
    return jsonError(500, message);
  }
}
