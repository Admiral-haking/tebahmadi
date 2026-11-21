import { Types } from 'mongoose';
import { loadMetaOverride } from '@/lib/cache';

export type Seo = {
  title?: string;
  description?: string;
  canonical?: string;
  noindex?: boolean;
  ogImageId?: Types.ObjectId;
  jsonLd?: unknown;
};

interface ResolveSeoInput {
  slug: string;
  entitySeo?: Seo;
  categorySeo?: Seo;
}

function mergeSeo(sources: Array<Seo | undefined | null>): Seo {
  const result: Seo = {};
  for (const source of sources) {
    if (!source) continue;
    if (typeof source.title === 'string') result.title = source.title;
    if (typeof source.description === 'string') result.description = source.description;
    if (typeof source.canonical === 'string') result.canonical = source.canonical;
    if (typeof source.noindex === 'boolean') result.noindex = source.noindex;
    if (source.ogImageId) result.ogImageId = source.ogImageId;
    if (typeof source.jsonLd !== 'undefined') result.jsonLd = source.jsonLd;
  }
  return result;
}

export async function resolveSeoForRoute({ slug, entitySeo, categorySeo }: ResolveSeoInput): Promise<Seo> {
  const override = await loadMetaOverride(slug);
  const overrideSeo = override?.seo as Seo | undefined;

  return mergeSeo([categorySeo, entitySeo, overrideSeo]);
}
