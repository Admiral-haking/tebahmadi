import { connectMongoose } from '@/lib/mongoose';
import ProductModel from '@/catalog/models/Product';
import { BlogPostModel } from '@/content/models/BlogPost';
import { PageModel } from '@/content/models/Page';

export type SitemapProduct = {
  slug?: string;
  createdAt?: Date;
  updatedAt?: Date;
};

export type SitemapBlogPost = {
  slug?: string;
  createdAt?: Date;
  updatedAt?: Date;
  publishedAt?: Date;
};

export type SitemapPage = {
  slug?: string;
  createdAt?: Date;
  updatedAt?: Date;
  publishedAt?: Date;
};

export async function loadSitemapProducts(): Promise<SitemapProduct[]> {
  await connectMongoose();
  return (await ProductModel.find({ status: 'active' })
    .select({ slug: 1, createdAt: 1, updatedAt: 1 })
    .lean<SitemapProduct>() as SitemapProduct[]);
}

export async function loadSitemapBlogPosts(): Promise<SitemapBlogPost[]> {
  await connectMongoose();
  return (await BlogPostModel.find({ status: 'published' })
    .sort({ publishedAt: -1 })
    .select({ slug: 1, createdAt: 1, updatedAt: 1, publishedAt: 1 })
    .lean<SitemapBlogPost>() as SitemapBlogPost[]);
}

export async function loadSitemapPages(): Promise<SitemapPage[]> {
  await connectMongoose();
  return (await PageModel.find({ status: 'published' })
    .sort({ publishedAt: -1 })
    .select({ slug: 1, createdAt: 1, updatedAt: 1, publishedAt: 1 })
    .lean<SitemapPage>()) as SitemapPage[];
}
