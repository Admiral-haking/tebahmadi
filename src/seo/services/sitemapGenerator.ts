"use server"
import { resolveSiteBaseUrl } from '@/seo/utils/url';
import {
  loadSitemapBlogPosts,
  loadSitemapPages,
  loadSitemapProducts,
} from '@/seo/services/sitemapData';

type ChangeFrequency =
  | 'always'
  | 'hourly'
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'yearly'
  | 'never';

type SitemapEntry = {
  loc: string;
  lastmod?: string;
  changefreq?: ChangeFrequency;
  priority?: number;
};

type StaticRoute = {
  path: string;
  changefreq?: ChangeFrequency;
  priority?: number;
};

const STATIC_ROUTES: StaticRoute[] = [
  { path: '/', changefreq: 'daily', priority: 1 },
  { path: '/store', changefreq: 'daily', priority: 0.9 },
  { path: '/blog', changefreq: 'weekly', priority: 0.7 },
  { path: '/cart', changefreq: 'monthly', priority: 0.4 },
  { path: '/auth', changefreq: 'monthly', priority: 0.2 },
  { path: '/payments/verify', changefreq: 'monthly', priority: 0.3 },
];

function ensureLeadingSlash(path: string): string {
  if (!path.startsWith('/')) {
    return `/${path}`;
  }
  return path;
}

function toIsoString(value: unknown): string | undefined {
  if (!value) return undefined;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value.toISOString();
  }
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
  }
  return undefined;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function resolveBaseUrl(): URL {
  return resolveSiteBaseUrl() ?? new URL('https://localhost');
}

function toAbsoluteUrl(path: string, baseUrl: URL): string {
  const normalized = ensureLeadingSlash(path.trim());
  return new URL(normalized, baseUrl).toString();
}

export async function buildSitemapEntries(): Promise<SitemapEntry[]> {
  const baseUrl = resolveBaseUrl();
  const entries: SitemapEntry[] = [];

  STATIC_ROUTES.forEach((route) => {
    entries.push({
      loc: toAbsoluteUrl(route.path, baseUrl),
      changefreq: route.changefreq,
      priority: route.priority,
    });
  });

  const [products, posts, pages] = await Promise.all([
    loadSitemapProducts().catch(() => []),
    loadSitemapBlogPosts().catch(() => []),
    loadSitemapPages().catch(() => []),
  ]);

  products.forEach((product: any) => {
    const slug = typeof product?.slug === 'string' ? product.slug.trim() : '';
    if (!slug) return;
    entries.push({
      loc: toAbsoluteUrl(`/product/${slug}`, baseUrl),
      lastmod: toIsoString(product?.updatedAt ?? product?.createdAt),
      changefreq: 'weekly',
      priority: 0.6,
    });
  });

  posts.forEach((post) => {
    const slug = typeof post?.slug === 'string' ? post.slug.trim() : '';
    if (!slug) return;
    entries.push({
      loc: toAbsoluteUrl(`/blog/${slug}`, baseUrl),
      lastmod: toIsoString(post?.updatedAt ?? post?.publishedAt ?? post?.createdAt),
      changefreq: 'weekly',
      priority: 0.5,
    });
  });

  pages.forEach((page) => {
    const slug = typeof page?.slug === 'string' ? page.slug.trim() : '';
    if (!slug) return;
    entries.push({
      loc: toAbsoluteUrl(`/page/${slug}`, baseUrl),
      lastmod: toIsoString(page?.updatedAt ?? page?.publishedAt ?? page?.createdAt),
      changefreq: 'monthly',
      priority: 0.4,
    });
  });

  const uniqueEntries = new Map<string, SitemapEntry>();
  entries.forEach((entry) => {
    if (!uniqueEntries.has(entry.loc)) {
      uniqueEntries.set(entry.loc, entry);
    }
  });

  return Array.from(uniqueEntries.values()).sort((a, b) => a.loc.localeCompare(b.loc));
}

export async function generateSitemapXml(): Promise<string> {
  const entries = await buildSitemapEntries();

  const lines: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ];

  entries.forEach((entry) => {
    lines.push('  <url>');
    lines.push(`    <loc>${escapeXml(entry.loc)}</loc>`);
    if (entry.lastmod) {
      lines.push(`    <lastmod>${escapeXml(entry.lastmod)}</lastmod>`);
    }
    if (entry.changefreq) {
      lines.push(`    <changefreq>${entry.changefreq}</changefreq>`);
    }
    if (typeof entry.priority === 'number') {
      const clamped = Math.min(1, Math.max(0, entry.priority));
      lines.push(`    <priority>${clamped.toFixed(1)}</priority>`);
    }
    lines.push('  </url>');
  });

  lines.push('</urlset>');
  return lines.join('\n');
}
