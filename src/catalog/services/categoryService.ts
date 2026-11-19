import { z } from 'zod';
import mongoose, { Types } from 'mongoose';
import { revalidatePath, revalidateTag, TAGS } from '@/lib/cache';
import CategoryModel, { type CategoryDocument } from '../models/Category';
import ProductTypeModel from '../models/ProductType';
import { objectIdString, nonEmptyString, slugSchema } from '../validation/sharedSchemas';

const CATEGORY_COLLECTION_PATHS = ['/categories', '/category'];

async function revalidateCategoryCaches(paths: string[] = [], previousPaths: string[] = []): Promise<void> {
  await revalidateTag(TAGS.CATEGORY_TREE);
  await revalidateTag(TAGS.CATALOG);

  for (const path of CATEGORY_COLLECTION_PATHS) {
    await revalidatePath(path);
  }

  for (const path of paths) {
    await revalidatePath(`/category/${path}`);
  }

  for (const path of previousPaths) {
    await revalidatePath(`/category/${path}`);
  }
}

const createCategorySchema = z.object({
  name: nonEmptyString.max(200),
  slug: slugSchema,
  parentId: objectIdString.nullish(),
  position: z.number().int().nonnegative().optional(),
  isActive: z.boolean().optional(),
  seoTitle: z.string().max(200).optional(),
  seoDescription: z.string().max(500).optional(),
  imageId: objectIdString.optional(),
  mediaId: objectIdString.optional().or(z.literal(null)).optional(),
  productTypeId: objectIdString.nullable().optional(),
});

const updateCategorySchema = createCategorySchema.partial();

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function computeHierarchy(
  slug: string,
  parent: CategoryDocument | null,
): {
  path: string;
  ancestors: Types.ObjectId[];
  depth: number;
} {
  if (!parent) {
    return {
      path: slug,
      ancestors: [],
      depth: 0,
    };
  }

  return {
    path: `${parent.path}/${slug}`,
    ancestors: [...parent.ancestors, parent._id as Types.ObjectId],
    depth: parent.depth + 1,
  };
}

export async function createCategory(payload: unknown): Promise<CategoryDocument> {
  const parsed = createCategorySchema.parse(payload);
  const parent = parsed.parentId ? await CategoryModel.findById(parsed.parentId).exec() : null;
  if (parsed.parentId && !parent) {
    throw new Error('Parent category not found');
  }

  const normalizedProductTypeId =
    typeof parsed.productTypeId === 'string'
      ? new mongoose.Types.ObjectId(parsed.productTypeId)
      : parsed.productTypeId === null
        ? null
        : undefined;

  if (!parent && !normalizedProductTypeId) {
    throw new Error('Root category requires a product type');
  }

  if (normalizedProductTypeId instanceof mongoose.Types.ObjectId) {
    const exists = await ProductTypeModel.exists({ _id: normalizedProductTypeId });
    if (!exists) {
      throw new Error('Product type not found');
    }
  }

  const hierarchy = computeHierarchy(parsed.slug, parent);

  const doc = await CategoryModel.create({
    name: parsed.name,
    slug: parsed.slug,
    parentId: parent?._id ?? null,
    path: hierarchy.path,
    ancestors: hierarchy.ancestors,
    depth: hierarchy.depth,
    position: parsed.position ?? 0,
    isActive: parsed.isActive ?? true,
    seoTitle: parsed.seoTitle,
    seoDescription: parsed.seoDescription,
    imageId: parsed.imageId ? new mongoose.Types.ObjectId(parsed.imageId) : undefined,
    mediaId:
      parsed.mediaId === null
        ? null
        : parsed.mediaId
          ? new mongoose.Types.ObjectId(parsed.mediaId)
          : undefined,
    productTypeId: normalizedProductTypeId instanceof mongoose.Types.ObjectId ? normalizedProductTypeId : undefined,
  });

  await revalidateCategoryCaches([doc.path]);
  return doc;
}

export async function getCategory(id: string): Promise<CategoryDocument | null> {
  return CategoryModel.findById(id).exec();
}

async function updateDescendantPaths(
  category: CategoryDocument,
  newPath: string,
  newAncestors: Types.ObjectId[],
  newDepth: number,
): Promise<void> {
  const oldPath = category.path;
  const descendants = await CategoryModel.find({ ancestors: category._id }).exec();
  const categoryIdString = category._id.toString();
  await CategoryModel.updateOne(
    { _id: category._id },
    {
      path: newPath,
      ancestors: newAncestors,
      depth: newDepth,
    },
  ).exec();

  for (const descendant of descendants) {
    const relativeSegment = descendant.path.startsWith(`${oldPath}/`)
      ? descendant.path.slice(oldPath.length + 1)
      : descendant.path;

    const indexOfCategory = descendant.ancestors.findIndex((id) => id.toString() === categoryIdString);
    const tailAncestors =
      indexOfCategory >= 0 ? descendant.ancestors.slice(indexOfCategory + 1) : descendant.ancestors;
    const updatedAncestors = [...newAncestors, category._id as Types.ObjectId, ...tailAncestors];

    await CategoryModel.updateOne(
      { _id: descendant._id },
      {
        path: relativeSegment ? `${newPath}/${relativeSegment}` : newPath,
        ancestors: updatedAncestors,
        depth: updatedAncestors.length,
      },
    ).exec();
  }
}

export async function updateCategory(
  id: string,
  payload: unknown,
): Promise<CategoryDocument | null> {
  const parsed = updateCategorySchema.parse(payload);
  const category = await CategoryModel.findById(id).exec();
  if (!category) {
    return null;
  }
  const previousPath = category.path;

  let parentDoc: CategoryDocument | null = null;
  if (parsed.parentId !== undefined) {
    if (!parsed.parentId) {
      parentDoc = null;
    } else {
      parentDoc = await CategoryModel.findById(parsed.parentId).exec();
      if (!parentDoc) {
        throw new Error('Parent category not found');
      }
      if (parentDoc._id.equals(category._id) || parentDoc.ancestors.includes(category._id)) {
        throw new Error('Cannot set category as its own ancestor');
      }
    }
  } else if (category.parentId) {
    parentDoc = await CategoryModel.findById(category.parentId).exec();
  }

  const updates: Record<string, unknown> = {};
  if (parsed.name !== undefined) updates.name = parsed.name;
  if (parsed.slug !== undefined) updates.slug = parsed.slug;
  if (parsed.position !== undefined) updates.position = parsed.position;
  if (parsed.isActive !== undefined) updates.isActive = parsed.isActive;
  if (parsed.seoTitle !== undefined) updates.seoTitle = parsed.seoTitle;
  if (parsed.seoDescription !== undefined) updates.seoDescription = parsed.seoDescription;
  if (parsed.imageId !== undefined) {
    updates.imageId = parsed.imageId ? new mongoose.Types.ObjectId(parsed.imageId) : undefined;
  }
  if (parsed.mediaId !== undefined) {
    updates.mediaId =
      parsed.mediaId === null
        ? null
        : parsed.mediaId
          ? new mongoose.Types.ObjectId(parsed.mediaId)
          : undefined;
  }
  if (parsed.parentId !== undefined) {
    updates.parentId = parsed.parentId ? new mongoose.Types.ObjectId(parsed.parentId) : null;
  }

  const normalizedProductTypeId =
    parsed.productTypeId === undefined
      ? undefined
      : typeof parsed.productTypeId === 'string'
        ? new mongoose.Types.ObjectId(parsed.productTypeId)
        : null;

  if (normalizedProductTypeId instanceof mongoose.Types.ObjectId) {
    const exists = await ProductTypeModel.exists({ _id: normalizedProductTypeId });
    if (!exists) {
      throw new Error('Product type not found');
    }
  }

  const finalParentId =
    parsed.parentId !== undefined
      ? parsed.parentId
        ? new mongoose.Types.ObjectId(parsed.parentId)
        : null
      : category.parentId ?? null;

  const finalProductTypeId =
    normalizedProductTypeId === undefined
      ? (category.productTypeId as mongoose.Types.ObjectId | null) ?? null
      : normalizedProductTypeId;

  if (!finalParentId && !finalProductTypeId) {
    throw new Error('Root category requires a product type');
  }

  if (normalizedProductTypeId !== undefined) {
    updates.productTypeId = normalizedProductTypeId;
  }

  const slugChanged = parsed.slug !== undefined && parsed.slug !== category.slug;
  const parentChanged =
    parsed.parentId !== undefined &&
    ((parsed.parentId === null && category.parentId !== null) ||
      (parsed.parentId && !category.parentId) ||
      (parsed.parentId && category.parentId && parsed.parentId.toString() !== category.parentId.toString()));

  if (slugChanged || parentChanged) {
    const hierarchy = computeHierarchy(parsed.slug ?? category.slug, parentDoc);
    await updateDescendantPaths(category, hierarchy.path, hierarchy.ancestors, hierarchy.depth);
    updates.path = hierarchy.path;
    updates.ancestors = hierarchy.ancestors;
    updates.depth = hierarchy.depth;
  }

  const updated = await CategoryModel.findByIdAndUpdate(id, updates, { new: true, runValidators: true }).exec();
  if (updated) {
    const changedPaths: string[] = [];
    if (updated.path) {
      changedPaths.push(updated.path);
    }
    const previousPaths: string[] = [];
    if (previousPath && previousPath !== updated.path) {
      previousPaths.push(previousPath);
    }
    await revalidateCategoryCaches(changedPaths, previousPaths);
  }
  return updated;
}

export async function deleteCategory(id: string): Promise<boolean> {
  const category = await CategoryModel.findById(id).lean();
  const hasChildren = await CategoryModel.exists({ parentId: id });
  if (hasChildren) {
    return false;
  }
  const result = await CategoryModel.findByIdAndDelete(id).exec();
  if (result) {
    await revalidateCategoryCaches([], category?.path ? [category.path] : []);
  }
  return !!result;
}

export async function listChildren(parentId?: string | null): Promise<CategoryDocument[]> {
  const query: Record<string, unknown> = {};
  if (parentId === undefined) {
    query.parentId = null;
  } else {
    query.parentId = parentId ? new mongoose.Types.ObjectId(parentId) : null;
  }
  return CategoryModel.find(query).sort({ position: 1, name: 1 }).exec();
}

export async function searchCategories(params: {
  q?: string;
  pathPrefix?: string;
  limit?: number;
}): Promise<CategoryDocument[]> {
  const { q, pathPrefix, limit = 50 } = params;
  const query: Record<string, unknown> = {};
  if (q) {
    query.name = { $regex: q, $options: 'i' };
  }
  if (pathPrefix) {
    query.path = { $regex: `^${escapeRegex(pathPrefix)}` };
  }
  return CategoryModel.find(query).sort({ depth: 1, position: 1 }).limit(limit).exec();
}

export async function subtreeIds(rootId: string): Promise<Types.ObjectId[]> {
  const rootObjectId = new mongoose.Types.ObjectId(rootId);
  const root = await CategoryModel.findById(rootObjectId, { _id: 1 }).exec();
  if (!root) {
    throw new Error('Category not found');
  }
  const descendants = await CategoryModel.find({ ancestors: rootObjectId }, { _id: 1 }).exec();
  return [rootObjectId, ...descendants.map((doc) => doc._id as Types.ObjectId)];
}

export async function getWithBreadcrumb(
  id: string,
): Promise<{ category: CategoryDocument; breadcrumb: CategoryDocument[] } | null> {
  const category = await CategoryModel.findById(id).exec();
  if (!category) return null;
  const breadcrumb = await CategoryModel.find({ _id: { $in: [...category.ancestors, category._id] } })
    .sort({ depth: 1 })
    .exec();
  return { category, breadcrumb };
}
