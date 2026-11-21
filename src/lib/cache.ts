import { unstable_cache, revalidateTag, revalidatePath } from 'next/cache';
import type { Document } from 'mongoose';
import { connectMongoose, isMongoConfigured } from '@/lib/mongoose';
import ProductModel, { type ProductDocument } from '@/catalog/models/Product';
import CategoryModel, { type CategoryDocument } from '@/catalog/models/Category';
import ProductTypeModel, { type ProductTypeDocument } from '@/catalog/models/ProductType';
import { BlogCategoryModel, type BlogCategoryDocument } from '@/content/models/BlogCategory';
import { BlogPostModel, type BlogPostDocument } from '@/content/models/BlogPost';
import { PageModel, type PageDocument } from '@/content/models/Page';
import { SlideModel, type SlideDocument } from '@/content/models/Slide';
import { MetaOverrideModel, type MetaOverrideDocument } from '@/seo/models/MetaOverride';
import { SiteInfoModel, type SiteInfoDocument } from '@/settings/models/SiteInfo';
import { SiteConfigModel, type SiteConfigDocument } from '@/settings/models/SiteConfig';
import { OfferModel, type OfferDocument } from '@/orders/models/Offer';
import { TransportModel, type TransportDocument } from '@/orders/models/Transport';
import { getDiscountProducts, getNewestProducts, getPopularProducts } from '@/catalog/services/productUtilService';
import { DEFAULT_SITE_INFO } from '@/config/brand';

export const TAGS = {
  SITE_INFO: 'site-info',
  SITE_CONFIG: 'site-config',
  CATEGORY_TREE: 'category-tree',
  PRODUCT_TYPE: (id: string) => `product-type:${id}`,
  PRODUCT: (slug: string) => `product:${slug}`,
  PRODUCT_LIST: 'product:list',
  CATALOG: 'catalog',
  BLOG_CATEGORY_TREE: 'blog:categories',
  BLOG_LIST: 'blog:list',
  BLOG_POST: (slug: string) => `blog:post:${slug}`,
  PAGE: (slug: string) => `page:${slug}`,
  PAGE_LIST: 'page:list',
  SLIDES: 'slides',
  META: (slug: string) => `meta:${slug}`,
  OFFERS: 'offers',
  OFFER: (code: string) => `offer:${code}`,
  TRANSPORT: 'transport',
  MEDIA_GROUP: (groupId: string) => `media:${groupId}`,
  SETTINGS: 'settings',
} as const;

type Lean<T> = T extends Document<infer U>
  ? U
  : T extends { toJSON(): infer R }
  ? R
  : T;

type AnyArray = readonly string[];

type AsyncFn<Args extends unknown[], Result> = (...args: Args) => Promise<Result>;

type TagFactory<Args extends unknown[]> = (...args: Args) => AnyArray;

function createCachedFunction<Args extends unknown[], Result>(
  fn: AsyncFn<Args, Result>,
  keyFactory: TagFactory<Args>,
  tagFactory?: TagFactory<Args>,
  fallback?: (...args: Args) => Result,
): AsyncFn<Args, Result> {
  return async (...args: Args) => {
    if (fallback && !isMongoConfigured()) {
      return fallback(...args);
    }
    const keyParts = [...keyFactory(...args)];
    const tags = tagFactory ? [...tagFactory(...args)] : undefined;
    const cached = unstable_cache(() => fn(...args), keyParts, tags ? { tags } : undefined);
    if (!fallback) {
      return cached();
    }
    try {
      return await cached();
    } catch (error) {
      console.warn(`Cache loader [${keyParts.join(':')}] failed; returning fallback`, error);
      return fallback(...args);
    }
  };
}

const loadSiteInfoCached = createCachedFunction(
  async () => {
    await connectMongoose();
    return (await SiteInfoModel.findOne().lean()) ?? (DEFAULT_SITE_INFO as unknown as Lean<SiteInfoDocument>);
  },
  () => ['site-info'],
  () => [TAGS.SITE_INFO, TAGS.SETTINGS],
  () => DEFAULT_SITE_INFO as unknown as Lean<SiteInfoDocument>,
);

export async function loadSiteInfo(): Promise<Lean<SiteInfoDocument> | null> {
  return loadSiteInfoCached();
}

const loadSiteConfigCached = createCachedFunction(
  async () => {
    await connectMongoose();
    return (await SiteConfigModel.findOne().lean()) ?? null;
  },
  () => ['site-config'],
  () => [TAGS.SITE_CONFIG, TAGS.SETTINGS],
  () => null,
);

export async function loadSiteConfig(): Promise<Lean<SiteConfigDocument> | null> {
  return loadSiteConfigCached();
}

const loadCategoryTreeCached = createCachedFunction(
  async () => {
    await connectMongoose();
    return CategoryModel.find({}).sort({ depth: 1, position: 1 }).lean();
  },
  () => ['category-tree'],
  () => [TAGS.CATEGORY_TREE, TAGS.CATALOG],
  () => [] as Lean<CategoryDocument>[],
);

export async function loadCategoryTree(): Promise<Lean<CategoryDocument>[]> {
  return loadCategoryTreeCached();
}

const loadProductTypeCached = createCachedFunction(
  async (id: string) => {
    await connectMongoose();
    return ProductTypeModel.findById(id).lean();
  },
  (id: string) => ['product-type-by-id', id],
  (id: string) => [TAGS.PRODUCT_TYPE(id), TAGS.CATALOG],
  () => null,
);

export async function loadProductType(id: string): Promise<Lean<ProductTypeDocument> | null> {
  return loadProductTypeCached(id);
}

const loadProductBySlugCached = createCachedFunction(
  async (slug: string) => {
    await connectMongoose();
    return ProductModel.findOne({ slug, status: { $ne: 'archived' } }).lean();
  },
  (slug: string) => ['product-by-slug', slug],
  (slug: string) => [TAGS.PRODUCT(slug), TAGS.CATALOG],
  () => null,
);

export async function loadProductBySlug(slug: string): Promise<Lean<ProductDocument> | null> {
  return loadProductBySlugCached(slug);
}

const loadProductsCached = createCachedFunction(
  async () => {
    await connectMongoose();
    return ProductModel.find({ status: 'active' }).sort({ createdAt: -1 }).lean();
  },
  () => ['product-list'],
  () => [TAGS.CATALOG, TAGS.PRODUCT_LIST],
  () => [] as Lean<ProductDocument>[],
);

export async function loadActiveProducts(): Promise<Lean<ProductDocument>[]> {
  return loadProductsCached();
}

const loadBlogCategoriesCached = createCachedFunction(
  async () => {
    await connectMongoose();
    return BlogCategoryModel.find({}).sort({ depth: 1, position: 1 }).lean();
  },
  () => ['blog-categories'],
  () => [TAGS.BLOG_CATEGORY_TREE],
  () => [] as Lean<BlogCategoryDocument>[],
);

export async function loadBlogCategories(): Promise<Lean<BlogCategoryDocument>[]> {
  return loadBlogCategoriesCached();
}

const loadBlogPostsCached = createCachedFunction(
  async () => {
    await connectMongoose();
    return BlogPostModel.find({ status: 'published' }).sort({ publishedAt: -1 }).lean();
  },
  () => ['blog-posts'],
  () => [TAGS.BLOG_LIST],
  () => [] as Lean<BlogPostDocument>[],
);

export async function loadPublishedBlogPosts(): Promise<Lean<BlogPostDocument>[]> {
  return loadBlogPostsCached();
}

const loadBlogPostBySlugCached = createCachedFunction(
  async (slug: string) => {
    await connectMongoose();
    return BlogPostModel.findOne({ slug, status: 'published' }).lean();
  },
  (slug: string) => ['blog-post-by-slug', slug],
  (slug: string) => [TAGS.BLOG_POST(slug), TAGS.BLOG_LIST],
  () => null,
);

export async function loadBlogPostBySlug(slug: string): Promise<Lean<BlogPostDocument> | null> {
  return loadBlogPostBySlugCached(slug);
}

const loadPublishedPagesCached = createCachedFunction(
  async () => {
    await connectMongoose();
    return PageModel.find({ status: 'published' }).sort({ publishedAt: -1 }).lean();
  },
  () => ['pages'],
  () => [TAGS.PAGE_LIST],
  () => [] as Lean<PageDocument>[],
);

export async function loadPublishedPages(): Promise<Lean<PageDocument>[]> {
  return loadPublishedPagesCached();
}

const loadPageBySlugCached = createCachedFunction(
  async (slug: string) => {
    await connectMongoose();
    return PageModel.findOne({ slug, status: 'published' }).lean();
  },
  (slug: string) => ['page-by-slug', slug],
  (slug: string) => [TAGS.PAGE(slug)],
  () => null,
);

export async function loadPageBySlug(slug: string): Promise<Lean<PageDocument> | null> {
  return loadPageBySlugCached(slug);
}

type SlideCacheItem = {
  id: string;
  mediaId: string;
  mediaDesktopId: string;
  mediaMobileId: string;
  href: string;
  createdAt: string;
  updatedAt: string;
};

function stringifyObjectId(value: unknown): string | null {
  if (!value) return null;
  return typeof value === 'string' ? value : value.toString();
}

const loadSlidesCached = createCachedFunction(
  async () => {
    await connectMongoose();
    const slides = await SlideModel.find({}).sort({ createdAt: -1 }).lean<SlideDocument[]>();
    return slides
      .map<SlideCacheItem | null>((slide) => {
        const legacyMediaId = stringifyObjectId(slide.mediaId);
        const mediaDesktopId = stringifyObjectId(slide.mediaDesktopId) ?? legacyMediaId;
        const mediaMobileId = stringifyObjectId(slide.mediaMobileId) ?? mediaDesktopId;
        const mediaId = legacyMediaId ?? mediaDesktopId;

        if (!mediaId || !mediaDesktopId || !mediaMobileId) {
          return null;
        }

        return {
          id: slide._id.toString(),
          mediaId,
          mediaDesktopId,
          mediaMobileId,
          href: slide.href,
          createdAt:
            slide.createdAt instanceof Date ? slide.createdAt.toISOString() : new Date(slide.createdAt).toISOString(),
          updatedAt:
            slide.updatedAt instanceof Date ? slide.updatedAt.toISOString() : new Date(slide.updatedAt).toISOString(),
        };
      })
      .filter((slide): slide is SlideCacheItem => Boolean(slide));
  },
  () => ['slides'],
  () => [TAGS.SLIDES],
  () => [] as SlideCacheItem[],
);

export async function loadSlides(): Promise<SlideCacheItem[]> {
  return loadSlidesCached();
}

const loadMetaOverrideCached = createCachedFunction(
  async (slug: string) => {
    await connectMongoose();
    return MetaOverrideModel.findOne({ slug }).lean();
  },
  (slug: string) => ['meta-override-by-slug', slug],
  (slug: string) => [TAGS.META(slug)],
  () => null,
);

export async function loadMetaOverride(slug: string): Promise<Lean<MetaOverrideDocument> | null> {
  return loadMetaOverrideCached(slug);
}

const loadOffersCached = createCachedFunction(
  async () => {
    await connectMongoose();
    return OfferModel.find({}).lean();
  },
  () => ['offers'],
  () => [TAGS.OFFERS],
  () => [] as Lean<OfferDocument>[],
);

export async function loadOffers(): Promise<Lean<OfferDocument>[]> {
  return loadOffersCached();
}

const loadTransportCached = createCachedFunction(
  async () => {
    await connectMongoose();
    return TransportModel.find({ isActive: true }).sort({ createdAt: -1 }).lean();
  },
  () => ['transport-list'],
  () => [TAGS.TRANSPORT],
  () => [] as Lean<TransportDocument>[],
);

export async function loadActiveTransports(): Promise<Lean<TransportDocument>[]> {
  return loadTransportCached();
}

const loadPopularProductsCached = createCachedFunction(
  async () => {
    await connectMongoose();
    return await getPopularProducts({ page: 1, perPage: 16 });
  },
  () => ['popular-home-v2'],
  () => [TAGS.PRODUCT_LIST],
  () => ({ items: [], total: 0, page: 1, perPage: 16 }),
)

export async function loadPopularProducts() {
  return loadPopularProductsCached();
}


const loadDiscountProductsCached = createCachedFunction(
  async () => {
    await connectMongoose();
    return await getDiscountProducts({ page: 1, perPage: 16 });
  },
  () => ['discount-home-v2'],
  () => [TAGS.PRODUCT_LIST],
  () => ({ items: [], total: 0, page: 1, perPage: 16 }),
)

export async function loadDiscountProducts() {
  return loadDiscountProductsCached();
}

const loadNewestProductsCached = createCachedFunction(
  async () => {
    await connectMongoose();
    return await getNewestProducts({ page: 1, perPage: 12 });
  },
  () => ['newest'],
  () => [TAGS.PRODUCT_LIST],
  () => ({ items: [], total: 0, page: 1, perPage: 12 }),
)

export async function loadNewestProducts() {
  return loadNewestProductsCached();
}

export { revalidateTag, revalidatePath };
