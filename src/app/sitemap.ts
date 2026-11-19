import type { ProductDocument } from "@/catalog/models/Product";
import type { CategoryDocument } from "@/catalog/models/Category";
import type { BlogPostDocument } from "@/content/models/BlogPost";
import type { PageDocument } from "@/content/models/Page";
import { loadActiveProducts, loadCategoryTree, loadPublishedBlogPosts, loadPublishedPages } from "@/lib/cache";
import { resolveSiteBaseUrl } from "@/seo/utils/url";

export const revalidate = 3600;

type LeanProduct = Partial<ProductDocument> & { slug?: string; updatedAt?: unknown };
type LeanCategory = Partial<CategoryDocument> & { path?: unknown };
type LeanPost = Partial<BlogPostDocument> & { slug?: string; updatedAt?: unknown };
type LeanPage = Partial<PageDocument> & { slug?: string; updatedAt?: unknown };

export default async function sitemap() {
  const baseUrl = ((await resolveSiteBaseUrl())?.toString() || "https://tebahmadi.ir").replace(/\/+$/, '');

  const [products, categories, blogPosts, pages] = await Promise.all([
    loadActiveProducts().catch((): LeanProduct[] => []) as Promise<LeanProduct[]>,
    loadCategoryTree().catch((): LeanCategory[] => []) as Promise<LeanCategory[]>,
    loadPublishedBlogPosts().catch((): LeanPost[] => []) as Promise<LeanPost[]>,
    loadPublishedPages().catch((): LeanPage[] => []) as Promise<LeanPage[]>,
  ]);

  const staticRoutes = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: "daily" as const, priority: 1.0 },
    { url: `${baseUrl}/store`, lastModified: new Date(), changeFrequency: "daily" as const, priority: 0.9 },
    { url: `${baseUrl}/blog`, lastModified: new Date(), changeFrequency: "weekly" as const, priority: 0.7 },
    { url: `${baseUrl}/search`, lastModified: new Date(), changeFrequency: "weekly" as const, priority: 0.5 },
  ];

  const productRoutes = products
    .filter((p) => p.slug)
    .map((p) => ({
      url: `${baseUrl}/product/${p.slug}`,
      lastModified: p.updatedAt ? new Date(p.updatedAt) : new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));

  const categoryRoutes = categories
    .filter((c) => c.path && String(c.path).trim())
    .map((c) => ({
      url: `${baseUrl}/store/${c.path}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }));

  const blogRoutes = blogPosts
    .filter((p) => p.slug)
    .map((p) => ({
      url: `${baseUrl}/blog/${p.slug}`,
      lastModified: p.updatedAt ? new Date(p.updatedAt) : new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    }));

  const pageRoutes = pages
    .filter((p) => p.slug)
    .map((p) => ({
      url: `${baseUrl}/page/${p.slug}`,
      lastModified: p.updatedAt ? new Date(p.updatedAt) : new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.5,
    }));

  return [...staticRoutes, ...productRoutes, ...categoryRoutes, ...blogRoutes, ...pageRoutes];
}
