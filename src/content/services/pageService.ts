import { FilterQuery } from 'mongoose';
import { revalidatePath, revalidateTag, TAGS } from '@/lib/cache';
import { PageModel, type PageDocument } from '@/content/models/Page';

const PAGE_COLLECTION_PATHS = ['/pages'];

function resolvePagePaths(slug: string): string[] {
  const basePaths = [`/${slug}`, `/page/${slug}`];
  const unique = new Set<string>();
  for (const path of basePaths) {
    if (path.trim().length > 0) {
      unique.add(path);
    }
  }
  return Array.from(unique);
}

async function revalidatePageCaches(slug: string, previousSlug?: string): Promise<void> {
  await revalidateTag(TAGS.PAGE(slug));

  for (const path of resolvePagePaths(slug)) {
    await revalidatePath(path);
  }

  for (const path of PAGE_COLLECTION_PATHS) {
    await revalidatePath(path);
  }

  if (previousSlug && previousSlug !== slug) {
    await revalidateTag(TAGS.PAGE(previousSlug));
    for (const path of resolvePagePaths(previousSlug)) {
      await revalidatePath(path);
    }
  }
}

interface PageInput {
  title: string;
  slug: string;
  content: string;
  status?: PageDocument['status'];
  publishedAt?: Date | string;
  seo?: PageDocument['seo'];
}

type PageUpdateInput = Partial<PageInput>;

interface ListPageFilters {
  q?: string;
  status?: PageDocument['status'] | PageDocument['status'][];
  limit?: number;
  skip?: number;
}

function ensureDate(value?: Date | string): Date | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function normalizeStatuses(
  status?: PageDocument['status'] | PageDocument['status'][]
): PageDocument['status'][] | undefined {
  if (!status) return undefined;
  return Array.isArray(status) ? status : [status];
}

export async function createPage(input: PageInput) {
  const now = new Date();
  const status = input.status ?? 'draft';
  const publishedAt = status === 'published' ? ensureDate(input.publishedAt) ?? now : ensureDate(input.publishedAt);

  const doc = await PageModel.create({
    title: input.title,
    slug: input.slug,
    content: input.content,
    status,
    publishedAt,
    seo: input.seo,
  });

  await revalidatePageCaches(doc.slug);
  return doc;
}

export async function updatePage(id: string, input: PageUpdateInput) {
  const page = await PageModel.findById(id);
  if (!page) {
    throw new Error('page_not_found');
  }

  const previousSlug = page.slug;

  if (typeof input.title === 'string') page.title = input.title;
  if (typeof input.slug === 'string') page.slug = input.slug;
  if (typeof input.content === 'string') page.content = input.content;
  if (typeof input.seo !== 'undefined') {
    page.set('seo', input.seo);
  }

  if (typeof input.status === 'string') {
    const prev = page.status;
    page.status = input.status;
    if (input.status === 'published' && !page.publishedAt) {
      page.publishedAt = ensureDate(input.publishedAt) ?? new Date();
    } else if (input.publishedAt) {
      page.publishedAt = ensureDate(input.publishedAt);
    } else if (prev !== 'published' && input.status !== 'published') {
      page.publishedAt = ensureDate(input.publishedAt);
    }
  } else if (input.publishedAt) {
    page.publishedAt = ensureDate(input.publishedAt);
  }

  await page.save();
  await revalidatePageCaches(page.slug, previousSlug);
  return page;
}

export async function listPages(filters: ListPageFilters = {}) {
  const query: FilterQuery<PageDocument> = {};

  const statuses = normalizeStatuses(filters.status);
  if (statuses && statuses.length > 0) {
    query.status = { $in: statuses };
  }

  if (filters.q) {
    query.title = { $regex: filters.q, $options: 'i' };
  }

  const limit = Math.min(Math.max(filters.limit ?? 20, 1), 100);
  const skip = Math.max(filters.skip ?? 0, 0);

  return PageModel.find(query)
    .sort({ publishedAt: -1, createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();
}

export async function getPageById(id: string) {
  return PageModel.findById(id).lean();
}

export async function getPageBySlug(slug: string) {
  return PageModel.findOne({ slug }).lean();
}

export async function softDeletePage(id: string) {
  const page = await PageModel.findByIdAndUpdate(
    id,
    { $set: { status: 'archived' } },
    { new: true }
  ).exec();
  if (page) {
    await revalidatePageCaches(page.slug);
  }
}
