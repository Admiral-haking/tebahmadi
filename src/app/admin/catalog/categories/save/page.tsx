import { headers } from 'next/headers';

import CategoryModel from '@/catalog/models/Category';
import ProductTypeModel from '@/catalog/models/ProductType';
import { connectMongoose } from '@/lib/mongoose';
import ToJson from '@/utils/toJson';
import CategorySave from '@/views/admin/catalog/categories/save';
import { buildAdminMetadata } from '@/lib/admin-metadata';

const CREATE_TITLE = 'دسته‌بندی جدید';
const EDIT_TITLE = 'ویرایش دسته‌بندی';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function resolveCategoryId(paramsPromise: SearchParams): Promise<string | undefined> {
  const params = await paramsPromise;
  const idParam = params?.id;
  return Array.isArray(idParam) ? idParam[0] : idParam ?? undefined;
}

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }) {
  const categoryId = await resolveCategoryId(searchParams);
  const title = categoryId ? EDIT_TITLE : CREATE_TITLE;
  return buildAdminMetadata(title);
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  headers();
  const categoryId = await resolveCategoryId(searchParams);

  await connectMongoose();

  const categoryPromise = categoryId
    ? CategoryModel.findById(categoryId)
        .lean()
        .then((category) => (category ? { ...category, id: category._id.toString() } : null))
    : Promise.resolve(null);

  const categoriesPromise = CategoryModel.find({}, { name: 1, path: 1, depth: 1 })
    .sort({ path: 1 })
    .lean();

  const descendantsPromise = categoryId
    ? CategoryModel.find({ ancestors: categoryId }, { _id: 1 }).lean()
    : Promise.resolve([]);

  const productTypesPromise = ProductTypeModel.find({}, { name: 1 })
    .sort({ name: 1 })
    .lean();

  const [category, categories, descendants, productTypes] = await Promise.all([
    categoryPromise,
    categoriesPromise,
    descendantsPromise,
    productTypesPromise,
  ]);

  const categoryOptions = categories.map((item) => ({
    id: item._id.toString(),
    name: item.name ?? '-',
    path: item.path ?? '-',
    depth: item.depth ?? 0,
  }));

  const excludedParentIds = category
    ? [category.id, ...descendants.map((item) => item._id.toString())]
    : [];

  const formattedCategory = category
    ? ToJson({
        id: category.id,
        name: category.name,
        slug: category.slug,
        parentId: category.parentId ? category.parentId.toString() : '',
        position: category.position ?? undefined,
        isActive: category.isActive ?? true,
        seoTitle: category.seoTitle ?? '',
        seoDescription: category.seoDescription ?? '',
        imageId: category.imageId ? category.imageId.toString() : undefined,
        mediaId: category.mediaId ? category.mediaId.toString() : undefined,
        productTypeId: category.productTypeId ? category.productTypeId.toString() : null,
      })
    : null;

  return (
    <CategorySave
      defaultValues={formattedCategory}
      categories={ToJson(categoryOptions)}
      excludedParentIds={ToJson(excludedParentIds)}
      productTypes={ToJson(
        productTypes.map((item) => ({
          id: item._id.toString(),
          name: item.name ?? '-',
        })),
      )}
    />
  );
}
