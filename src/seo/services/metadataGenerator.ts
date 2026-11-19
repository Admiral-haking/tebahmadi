import type { Metadata } from 'next';
import type { Types } from 'mongoose';

import { loadSiteInfo } from '@/lib/cache';
import { resolveSeoForRoute, type Seo } from './metaResolve';
import { buildMediaUrl, resolveSiteBaseUrl, toAbsoluteUrl } from '@/seo/utils/url';

type MediaLike = {
  id?: Types.ObjectId | string | null;
  url?: string | null;
  alt?: string | null;
};

type GenerateMetadataInput = {
  slug: string;
  entitySeo?: Seo;
  categorySeo?: Seo;
  defaults?: {
    title?: string | null;
    description?: string | null;
    canonical?: string | null;
    noindex?: boolean | null;
    image?: MediaLike | null;
  };
  openGraphType?: string;
  other?: Record<string, string | undefined | null>;
};

type GenerateMetadataResult = {
  metadata: Metadata;
  jsonLd?: unknown;
};

function toStringId(value: Types.ObjectId | string | null | undefined): string | undefined {
  if (!value) return undefined;
  return typeof value === 'string' ? value : value.toString();
}

function coalesce<T>(...values: Array<T | null | undefined>): T | undefined {
  for (const value of values) {
    if (value !== undefined && value !== null) {
      return value;
    }
  }
  return undefined;
}

function normalizeCanonical(canonical: string | undefined, base?: URL): string | undefined {
  if (!canonical) return undefined;
  if (/^https?:\/\//i.test(canonical)) {
    return canonical;
  }
  if (canonical.startsWith('//')) {
    return canonical;
  }
  if (!canonical.startsWith('/')) {
    canonical = `/${canonical}`;
  }
  return toAbsoluteUrl(canonical, base);
}

function normalizeOtherMeta(other?: Record<string, string | undefined | null>) {
  if (!other) return undefined;
  const entries = Object.entries(other).filter(
    ([key, value]) => Boolean(key) && typeof value === 'string' && value.trim().length > 0,
  ) as Array<[string, string]>;
  if (!entries.length) return undefined;
  return Object.fromEntries(entries);
}

export async function generatePageMetadata({
  slug,
  entitySeo,
  categorySeo,
  defaults,
  other,
}: GenerateMetadataInput): Promise<GenerateMetadataResult> {
  const siteInfoPromise = loadSiteInfo();
  const seoPromise = resolveSeoForRoute({
    slug,
    entitySeo,
    categorySeo,
  });

  const baseUrl = resolveSiteBaseUrl();
  const [siteInfo, resolvedSeo] = await Promise.all([siteInfoPromise, seoPromise]);

  const title = coalesce(resolvedSeo.title, defaults?.title);
  const description = coalesce(resolvedSeo.description, defaults?.description);
  const canonical = normalizeCanonical(coalesce(resolvedSeo.canonical, defaults?.canonical));
  const noindex = coalesce(resolvedSeo.noindex, defaults?.noindex);

  const resolvedImageId = coalesce(toStringId(resolvedSeo.ogImageId), toStringId(defaults?.image?.id));
  const resolvedImageUrl = coalesce(
    defaults?.image?.url ?? undefined,
    resolvedImageId ? buildMediaUrl(resolvedImageId, baseUrl ?? undefined) : undefined,
  );
  const imageAlt = coalesce(defaults?.image?.alt, title, siteInfo?.appName);

  const metadata: Metadata = {};

  if (title) {
    metadata.title = title;
  }

  if (description) {
    metadata.description = description;
  }

  if (canonical) {
    metadata.alternates = { canonical };
  }

  if (typeof noindex === 'boolean') {
    metadata.robots = {
      index: !noindex,
      follow: !noindex,
    };
  }

  metadata.openGraph = {
    title: title ?? undefined,
    description: description ?? undefined,
    url: canonical ?? baseUrl?.toString(),
    siteName: siteInfo?.appName ?? title ?? undefined,
    images: resolvedImageUrl
      ? [
        {
          url: resolvedImageUrl,
          alt: imageAlt ?? undefined,
        },
      ]
      : undefined,
  };

  metadata.twitter = {
    card: resolvedImageUrl ? 'summary_large_image' : 'summary',
    title: title ?? undefined,
    description: description ?? undefined,
    images: resolvedImageUrl ? [resolvedImageUrl] : undefined,
  };

  if (baseUrl) {
    metadata.metadataBase = baseUrl;
  }

  const normalizedOther = normalizeOtherMeta(other);
  if (normalizedOther) {
    metadata.other = normalizedOther;
  }

  return {
    metadata,
    jsonLd: resolvedSeo.jsonLd,
  };
}
