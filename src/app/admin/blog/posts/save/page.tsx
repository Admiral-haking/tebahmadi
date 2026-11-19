import { headers } from "next/headers";

import { connectMongoose } from "@/lib/mongoose";
import ToJson from "@/utils/toJson";
import { BlogPostModel } from "@/content/models/BlogPost";
import { BlogCategoryModel } from "@/content/models/BlogCategory";
import BlogPostSave, {
  type BlogPostDTO,
  type BlogCategoryOption,
} from "@/views/admin/blog/posts/save";
import { buildAdminMetadata } from "@/lib/admin-metadata";

const CREATE_TITLE = "افزودن نوشته جدید";
const EDIT_TITLE = "ویرایش نوشته";

type SearchParamsPromise = Promise<Record<string, string | string[] | undefined>> | undefined;

async function resolvePostId(searchParams?: SearchParamsPromise): Promise<string | undefined> {
  const params = searchParams ? await searchParams : undefined;
  const idParam = params?.id;
  return Array.isArray(idParam) ? idParam[0] : idParam ?? undefined;
}

export async function generateMetadata({ searchParams }: { searchParams?: SearchParamsPromise }) {
  const postId = await resolvePostId(searchParams);
  const title = postId ? EDIT_TITLE : CREATE_TITLE;
  return buildAdminMetadata(title);
}

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  headers();
  const postId = await resolvePostId(searchParams);

  await connectMongoose();

  const postPromise = postId
    ? BlogPostModel.findById(postId)
        .lean()
        .then((post) => (post ? { ...post, id: post._id.toString() } : null))
    : Promise.resolve(null);

  const categoriesPromise = BlogCategoryModel.find({}, { name: 1, path: 1, depth: 1 })
    .sort({ path: 1 })
    .lean();

  const [postDoc, categoriesDocs] = await Promise.all([postPromise, categoriesPromise]);

  const categoryOptions: BlogCategoryOption[] = categoriesDocs.map((category) => ({
    id: category._id.toString(),
    name: category.name ?? "-",
    path: category.path ?? "-",
    depth: category.depth ?? 0,
  }));

  let formattedPost: BlogPostDTO | null = null;
  if (postDoc) {
    formattedPost = {
      id: postDoc.id,
      title: postDoc.title ?? "",
      slug: postDoc.slug ?? "",
      status: postDoc.status ?? "draft",
      excerpt: postDoc.excerpt ?? "",
      content: postDoc.content ?? "<p></p>",
      coverImageId: postDoc.coverImageId ? postDoc.coverImageId.toString() : null,
      categories: Array.isArray(postDoc.categories) ? postDoc.categories.map((id) => id.toString()) : [],
      tags: Array.isArray(postDoc.tags) ? postDoc.tags.filter((tag): tag is string => typeof tag === "string") : [],
      authorId: postDoc.authorId ? postDoc.authorId.toString() : null,
      publishedAt: postDoc.publishedAt ? postDoc.publishedAt.toISOString() : null,
      seo: postDoc.seo
        ? {
            title: postDoc.seo.title ?? "",
            description: postDoc.seo.description ?? "",
            canonical: postDoc.seo.canonical ?? "",
            noindex: postDoc.seo.noindex ?? false,
            ogImageId: postDoc.seo.ogImageId ? postDoc.seo.ogImageId.toString() : "",
            jsonLd: postDoc.seo.jsonLd ?? undefined,
          }
        : null,
    };
  }

  return (
    <BlogPostSave
      defaultValues={formattedPost ? ToJson(formattedPost) : null}
      categories={ToJson(categoryOptions)}
    />
  );
}
