import { z } from 'zod';

export const SITE_PAGE_KEYS = ['about', 'terms', 'privacy'] as const;
export type SitePageKey = (typeof SITE_PAGE_KEYS)[number];

export const sitePageContentSchema = z.object({
  title: z.string().trim().max(160, 'عنوان صفحه بیش از حد طولانی است.').optional().or(z.literal('')),
  description: z.string().trim().max(320, 'توضیح صفحه بیش از حد طولانی است.').optional().or(z.literal('')),
  content: z.string().max(50000, 'محتوای صفحه بیش از حد طولانی است.').optional().or(z.literal('')),
});

export const sitePagesSchema = z.object({
  about: sitePageContentSchema.optional(),
  terms: sitePageContentSchema.optional(),
  privacy: sitePageContentSchema.optional(),
});

export type SitePageContent = z.infer<typeof sitePageContentSchema>;
export type SitePages = z.infer<typeof sitePagesSchema>;
export type ConfiguredSitePages = Partial<Record<SitePageKey, SitePageContent | null>>;

export const SITE_PAGE_LABELS: Record<SitePageKey, string> = {
  about: 'درباره ما',
  terms: 'شرایط خرید',
  privacy: 'حریم خصوصی',
};

const DEFAULT_SITE_PAGE_META: Record<SitePageKey, { title: string; description: string }> = {
  about: {
    title: 'درباره طب احمدی',
    description: 'طب احمدی؛ انتخابی مطمئن برای محصولات طبیعی و گیاهان دارویی.',
  },
  terms: {
    title: 'شرایط خرید',
    description: 'شرایط خرید و ارسال سفارش از طب احمدی.',
  },
  privacy: {
    title: 'حریم خصوصی',
    description: 'سیاست حریم خصوصی طب احمدی.',
  },
};

export type ResolvedSitePage = {
  title: string;
  description: string;
  content: string;
};

export function resolveConfiguredSitePage(
  pages: ConfiguredSitePages | null | undefined,
  slug: string,
): ResolvedSitePage | null {
  if (!SITE_PAGE_KEYS.includes(slug as SitePageKey)) return null;

  const key = slug as SitePageKey;
  const configured = pages?.[key];
  const content = configured?.content?.trim() ?? '';
  if (!content) return null;

  const defaults = DEFAULT_SITE_PAGE_META[key];
  return {
    title: configured?.title?.trim() || defaults.title,
    description: configured?.description?.trim() || defaults.description,
    content,
  };
}
