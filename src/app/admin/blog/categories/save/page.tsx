import { headers } from "next/headers";

import { connectMongoose } from "@/lib/mongoose";
import ToJson from "@/utils/toJson";
import { BlogCategoryModel } from "@/content/models/BlogCategory";
import BlogCategorySave, {
  type BlogCategoryDTO,
  type BlogCategoryOption,
} from "@/views/admin/blog/categories/save";
import { buildAdminMetadata } from "@/lib/admin-metadata";

const CREATE_TITLE = "افزودن دسته جدید";
const EDIT_TITLE = "ویرایش دسته وبلاگ";

type SearchParamsPromise = Promise<Record<string, string | string[] | undefined>> | undefined;

async function resolveCategoryId(searchParams?: SearchParamsPromise): Promise<string | undefined> {
  const params = searchParams ? await searchParams : undefined;
  const idParam = params?.id;
  return Array.isArray(idParam) ? idParam[0] : idParam ?? undefined;
}

export async function generateMetadata({ searchParams }: { searchParams?: SearchParamsPromise }) {
  const categoryId = await resolveCategoryId(searchParams);
  const title = categoryId ? EDIT_TITLE : CREATE_TITLE;
  return buildAdminMetadata(title);
}

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  headers();
  const categoryId = await resolveCategoryId(searchParams);

  await connectMongoose();

  const categoryPromise = categoryId
    ? BlogCategoryModel.findById(categoryId)
        .lean()
        .then((category) => (category ? { ...category, id: category._id.toString() } : null))
    : Promise.resolve(null);

  const categoriesPromise = BlogCategoryModel.find({}, { name: 1, path: 1, depth: 1 })
    .sort({ path: 1 })
    .lean();

  const descendantsPromise = categoryId
    ? BlogCategoryModel.find({ ancestors: categoryId }, { _id: 1 }).lean()
    : Promise.resolve([]);

  const [categoryDoc, categoryOptionsRaw, descendants] = await Promise.all([
    categoryPromise,
    categoriesPromise,
    descendantsPromise,
  ]);

  const options: BlogCategoryOption[] = categoryOptionsRaw.map((category) => ({
    id: category._id.toString(),
    name: category.name ?? "-",
    path: category.path ?? "-",
    depth: category.depth ?? 0,
  }));

  const excludedParentIds = categoryDoc
    ? [categoryDoc.id, ...descendants.map((item) => item._id.toString())]
    : [];

  let formattedCategory: BlogCategoryDTO | null = null;
  if (categoryDoc) {
    formattedCategory = {
      id: categoryDoc.id,
      name: categoryDoc.name ?? "",
      slug: categoryDoc.slug ?? "",
      parentId: categoryDoc.parentId ? categoryDoc.parentId.toString() : "",
      position: typeof categoryDoc.position === "number" ? categoryDoc.position : null,
      isActive: categoryDoc.isActive ?? true,
      seo: categoryDoc.seo
        ? {
            title: categoryDoc.seo.title ?? "",
            description: categoryDoc.seo.description ?? "",
            canonical: categoryDoc.seo.canonical ?? "",
            noindex: categoryDoc.seo.noindex ?? false,
            ogImageId: categoryDoc.seo.ogImageId ? categoryDoc.seo.ogImageId.toString() : "",
            jsonLd: categoryDoc.seo.jsonLd ?? undefined,
          }
        : null,
    };
  }

  return (
    <BlogCategorySave
      defaultValues={formattedCategory ? ToJson(formattedCategory) : null}
      categories={ToJson(options)}
      excludedParentIds={ToJson(excludedParentIds)}
    />
  );
}
