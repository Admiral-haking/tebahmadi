import { FilterQuery, Types } from 'mongoose';
import { revalidatePath, revalidateTag, TAGS } from '@/lib/cache';
import { BlogPostModel, type BlogPostDocument } from '@/content/models/BlogPost';
import { subtreeIds } from '@/content/services/categoryService';

const BLOG_POST_BASE_PATHS = ['/blog'];

async function revalidatePostCaches(slug: string, previousSlug?: string): Promise<void> {
  await Promise.all([
    revalidateTag(TAGS.BLOG_POST(slug)),
    revalidateTag(TAGS.BLOG_LIST),
  ]);

  await Promise.all([
    revalidatePath(`/blog/${slug}`),
    ...BLOG_POST_BASE_PATHS.map((path) => revalidatePath(path)),
  ]);

  if (previousSlug && previousSlug !== slug) {
    await Promise.all([
      revalidateTag(TAGS.BLOG_POST(previousSlug)),
      revalidatePath(`/blog/${previousSlug}`),
    ]);
  }
}

interface PostInput {
  title: string;
  slug: string;
  excerpt?: string;
  content: string;
  coverImageId?: string;
  categories?: string[];
  tags?: string[];
  authorId?: string;
  status?: BlogPostDocument['status'];
  publishedAt?: Date | string;
  seo?: BlogPostDocument['seo'];
}

type PostUpdateInput = Partial<PostInput>;

interface ListPostFilters {
  q?: string;
  categoryId?: string;
  includeSubtree?: boolean;
  status?: BlogPostDocument['status'] | BlogPostDocument['status'][];
  limit?: number;
  skip?: number;
}

function ensureDate(value?: Date | string): Date | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function normalizeStatusFilter(
  status?: BlogPostDocument['status'] | BlogPostDocument['status'][]
): BlogPostDocument['status'][] | undefined {
  if (!status) return undefined;
  return Array.isArray(status) ? status : [status];
}

export async function createPost(input: PostInput) {
  const now = new Date();
  const status = input.status ?? 'draft';
  const publishedAt = status === 'published' ? ensureDate(input.publishedAt) ?? now : ensureDate(input.publishedAt);

  const doc = await BlogPostModel.create({
    title: input.title,
    slug: input.slug,
    excerpt: input.excerpt,
    content: input.content,
    coverImageId: input.coverImageId ? new Types.ObjectId(input.coverImageId) : undefined,
    categories: (input.categories ?? []).map((id) => new Types.ObjectId(id)),
    tags: input.tags,
    authorId: input.authorId ? new Types.ObjectId(input.authorId) : undefined,
    status,
    publishedAt,
    seo: input.seo,
  });

  await revalidatePostCaches(doc.slug);
  return doc;
}

export async function updatePost(id: string, input: PostUpdateInput) {
  const post = await BlogPostModel.findById(id);
  if (!post) {
    throw new Error('post_not_found');
  }

  const previousSlug = post.slug;

  if (typeof input.title === 'string') post.title = input.title;
  if (typeof input.slug === 'string') post.slug = input.slug;
  if (typeof input.excerpt === 'string' || input.excerpt === null) post.excerpt = input.excerpt ?? undefined;
  if (typeof input.content === 'string') post.content = input.content;
  if (typeof input.coverImageId === 'string') post.coverImageId = new Types.ObjectId(input.coverImageId);
  if (input.coverImageId === null) post.coverImageId = undefined;
  if (Array.isArray(input.categories)) post.categories = input.categories.map((id) => new Types.ObjectId(id));
  if (Array.isArray(input.tags)) post.tags = input.tags;
  if (typeof input.authorId === 'string') post.authorId = new Types.ObjectId(input.authorId);
  if (typeof input.seo !== 'undefined') {
    post.set('seo', input.seo);
  }

  if (typeof input.status === 'string') {
    const previousStatus = post.status;
    post.status = input.status;
    if (input.status === 'published' && !post.publishedAt) {
      post.publishedAt = ensureDate(input.publishedAt) ?? new Date();
    } else if (input.publishedAt) {
      post.publishedAt = ensureDate(input.publishedAt);
    } else if (previousStatus !== 'published' && input.status !== 'published') {
      post.publishedAt = ensureDate(input.publishedAt);
    }
  } else if (input.publishedAt) {
    post.publishedAt = ensureDate(input.publishedAt);
  }

  await post.save();
  await revalidatePostCaches(post.slug, previousSlug);
  return post;
}

export async function listPosts(filters: ListPostFilters = {}) {
  const query: FilterQuery<BlogPostDocument> = {};

  const statuses = normalizeStatusFilter(filters.status);
  if (statuses && statuses.length > 0) {
    query.status = { $in: statuses };
  }

  if (filters.q) {
    query.$text = { $search: filters.q } as FilterQuery<BlogPostDocument>['$text'];
  }

  if (filters.categoryId) {
    let categoryIds: string[] = [filters.categoryId];
    if (filters.includeSubtree) {
      categoryIds = await subtreeIds(filters.categoryId);
    }
    query.categories = { $in: categoryIds.map((id) => new Types.ObjectId(id)) };
  }

  const limit = Math.min(Math.max(filters.limit ?? 20, 1), 100);
  const skip = Math.max(filters.skip ?? 0, 0);

  const cursor = BlogPostModel.find(query)
    .sort({ publishedAt: -1, createdAt: -1 })
    .skip(skip)
    .limit(limit);

  if (filters.q) {
    cursor.select({ score: { $meta: 'textScore' } }).sort({ score: { $meta: 'textScore' }, publishedAt: -1 });
  }

  return cursor.lean();
}

export async function getPostById(id: string) {
  return BlogPostModel.findById(id).lean();
}

export async function softDeletePost(id: string) {
  const post = await BlogPostModel.findByIdAndUpdate(
    id,
    { $set: { status: 'archived' } },
    { new: true }
  ).exec();
  if (post) {
    await revalidatePostCaches(post.slug);
  }
}
