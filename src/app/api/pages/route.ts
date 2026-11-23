import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { FilterQuery, Types } from 'mongoose';
import { connectMongoose } from '@/lib/mongoose';
import { createPage } from '@/content/services/pageService';
import { PageModel, type PageDocument } from '@/content/models/Page';
import { zSeo, zSlug, zStatus, zStringNonEmpty } from '@/lib/z';
import { requirePermission } from '@/lib/auth';

const querySchema = z.object({
  q: z.string().optional(),
  status: z.string().optional(),
  limit: z.coerce.number().int().positive().optional(),
  skip: z.coerce.number().int().min(0).optional(),
  metrics: z.string().optional(),
});

const createSchema = z.object({
  title: zStringNonEmpty,
  slug: zSlug,
  content: z.string().min(1),
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

function normalizeStatuses(
  status?: PageDocument['status'] | PageDocument['status'][]
): PageDocument['status'][] | undefined {
  if (!status) return undefined;
  return Array.isArray(status) ? status : [status];
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const DATE_FORMAT = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
  dateStyle: 'medium',
  timeStyle: 'short',
});
const RELATIVE_TIME_FORMAT = new Intl.RelativeTimeFormat('fa-IR', { numeric: 'auto' });

function formatDate(value?: Date | null): string {
  if (!value) return '—';
  return DATE_FORMAT.format(value);
}

function formatRelative(value?: Date | null): string {
  if (!value) return '—';
  const diffMs = value.getTime() - Date.now();
  const diffMinutes = diffMs / (1000 * 60);
  if (Math.abs(diffMinutes) < 60) {
    return RELATIVE_TIME_FORMAT.format(Math.round(diffMinutes), 'minute');
  }
  const diffHours = diffMinutes / 60;
  if (Math.abs(diffHours) < 24) {
    return RELATIVE_TIME_FORMAT.format(Math.round(diffHours), 'hour');
  }
  const diffDays = diffHours / 24;
  if (Math.abs(diffDays) < 14) {
    return RELATIVE_TIME_FORMAT.format(Math.round(diffDays), 'day');
  }
  const diffWeeks = diffDays / 7;
  return RELATIVE_TIME_FORMAT.format(Math.round(diffWeeks), 'week');
}

function stripHtml(value: string | null | undefined): string {
  if (!value) return '';
  return value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function createExcerpt(html: string | null | undefined, limit = 160): string {
  const text = stripHtml(html);
  if (text.length <= limit) return text;
  return `${text.slice(0, limit - 1)}…`;
}

export async function GET(request: NextRequest) {
  await connectMongoose();
  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const statusFilters = parsed.data.status
    ? parsed.data.status
        .split(',')
        .map((item) => item.trim())
        .filter((item): item is PageDocument['status'] =>
          ['draft', 'published', 'archived'].includes(item as PageDocument['status'])
        )
    : undefined;
  const limit = Math.min(Math.max(parsed.data.limit ?? 20, 1), 100);
  const skip = Math.max(parsed.data.skip ?? 0, 0);

  const filter: FilterQuery<PageDocument> = {};

  const normalizedStatuses = normalizeStatuses(statusFilters);
  if (normalizedStatuses && normalizedStatuses.length > 0) {
    filter.status = { $in: normalizedStatuses };
  }

  if (parsed.data.q) {
    const regex = new RegExp(escapeRegExp(parsed.data.q.trim()), 'i');
    filter.$or = [{ title: regex }, { slug: regex }, { 'seo.title': regex }, { 'seo.description': regex }];
  }

  const includeMetrics = ['1', 'true', 'yes'].includes((parsed.data.metrics ?? '').toLowerCase());

  const now = new Date();
  const lastSevenDays = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [pagesRaw, totalCount, aggregated, latestPublished, publishedLastWeek] = await Promise.all([
    PageModel.find(filter)
      .sort({ updatedAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean({ getters: true }),
    PageModel.countDocuments(filter),
    includeMetrics
      ? PageModel.aggregate<{ _id: PageDocument['status']; count: number }>([
          {
            $group: {
              _id: '$status',
              count: { $sum: 1 },
            },
          },
        ]).exec()
      : Promise.resolve([]),
    includeMetrics
      ? PageModel.findOne({ status: 'published', publishedAt: { $ne: null } })
          .sort({ publishedAt: -1 })
          .lean({ getters: true })
      : Promise.resolve(null),
    includeMetrics
      ? PageModel.countDocuments({ status: 'published', publishedAt: { $gte: lastSevenDays } })
      : Promise.resolve(0),
  ]);

  const statusCounts: Record<PageDocument['status'], number> = {
    draft: 0,
    published: 0,
    archived: 0,
  };

  aggregated.forEach((bucket) => {
    if (bucket?._id && ['draft', 'published', 'archived'].includes(bucket._id)) {
      statusCounts[bucket._id] = bucket.count;
    }
  });

  const data = pagesRaw.map((doc) => {
    const publishedAt =
      doc.publishedAt instanceof Date ? doc.publishedAt : doc.publishedAt ? new Date(doc.publishedAt) : null;
    const updatedAt =
      doc.updatedAt instanceof Date ? doc.updatedAt : doc.updatedAt ? new Date(doc.updatedAt) : null;

    return {
      id: doc._id?.toString() ?? '',
      title: doc.title ?? 'Untitled',
      slug: doc.slug ?? '',
      status: doc.status ?? 'draft',
      publishedAt: publishedAt ? publishedAt.toISOString() : null,
      updatedAt: updatedAt ? updatedAt.toISOString() : null,
      publishedAtLabel: formatDate(publishedAt),
      updatedAtLabel: `${formatDate(updatedAt)} · ${formatRelative(updatedAt)}`,
      excerpt: createExcerpt(doc.content ?? ''),
      seoTitle: doc.seo?.title ?? undefined,
    };
  });

  const latestPublishedAt =
    latestPublished && latestPublished.publishedAt
      ? formatDate(
          latestPublished.publishedAt instanceof Date
            ? latestPublished.publishedAt
            : new Date(latestPublished.publishedAt),
        )
      : null;

  return NextResponse.json({
    data,
    meta: {
      total: totalCount,
      limit,
      skip,
      statusCounts,
      latestPublishedAt,
      publishedLastWeek,
    },
  });
}

export async function POST(request: NextRequest) {
  await connectMongoose();
  await requirePermission(request, 'catalog:publish');
  try {
    const body = await request.json();
    const parsed = createSchema.parse(body);
    const page = await createPage({
      title: parsed.title,
      slug: parsed.slug,
      content: parsed.content,
      status: parsed.status,
      publishedAt: parsed.publishedAt,
      seo: mapSeo(parsed.seo),
    });
    return NextResponse.json({ data: page }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    const mongoError = error as { code?: number };
    if (mongoError?.code === 11000) {
      return NextResponse.json({ error: 'duplicate_slug' }, { status: 409 });
    }
    console.error('Failed to create page', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
