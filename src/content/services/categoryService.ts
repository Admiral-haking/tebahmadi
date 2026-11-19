import { Types } from 'mongoose';
import { revalidatePath, revalidateTag, TAGS } from '@/lib/cache';
import { BlogCategoryModel, type BlogCategoryDocument } from '@/content/models/BlogCategory';
import { BlogPostModel } from '@/content/models/BlogPost';

const BLOG_CATEGORY_BASE_PATHS = ['/blog'];

async function revalidateBlogCategoryCaches(paths: string[] = [], previousPaths: string[] = []): Promise<void> {
  await revalidateTag(TAGS.BLOG_CATEGORY_TREE);
  await revalidateTag(TAGS.BLOG_LIST);

  for (const path of BLOG_CATEGORY_BASE_PATHS) {
    await revalidatePath(path);
  }

  for (const path of paths) {
    await revalidatePath(`/blog/category/${path}`);
  }

  for (const path of previousPaths) {
    await revalidatePath(`/blog/category/${path}`);
  }
}

interface CategoryInput {
  name: string;
  slug: string;
  parentId?: string | null;
  position?: number;
  isActive?: boolean;
  seo?: BlogCategoryDocument['seo'];
}

interface CategoryUpdateInput {
  name?: string;
  slug?: string;
  parentId?: string | null;
  position?: number;
  isActive?: boolean;
  seo?: BlogCategoryDocument['seo'];
}

function buildPath(slug: string, parent?: BlogCategoryDocument | null): string {
  if (!parent) {
    return slug;
  }
  return `${parent.path}/${slug}`;
}

function buildAncestors(parent?: BlogCategoryDocument | null): Types.ObjectId[] {
  if (!parent) {
    return [] as Types.ObjectId[];
  }
  const ancestors = [...((parent.ancestors ?? []) as Types.ObjectId[])];
  ancestors.push(parent._id);
  return ancestors;
}

async function fetchParent(parentId?: string | null) {
  if (!parentId) {
    return null;
  }
  return BlogCategoryModel.findById(parentId).exec();
}

export async function createCategory(input: CategoryInput) {
  const parent = await fetchParent(input.parentId ?? null);
  const path = buildPath(input.slug, parent ?? undefined);
  const ancestors = buildAncestors(parent ?? undefined);
  const depth = ancestors.length;

  const createdDoc = await BlogCategoryModel.create({
    name: input.name,
    slug: input.slug,
    parentId: parent?._id ?? null,
    path,
    ancestors,
    depth,
    position: input.position ?? 0,
    isActive: input.isActive ?? true,
    seo: input.seo,
  });

  if (!createdDoc) {
    throw new Error('create_failed');
  }

  await revalidateBlogCategoryCaches([createdDoc.path]);
  return createdDoc;
}

async function cascadePaths(root: BlogCategoryDocument) {
  const descendants = await BlogCategoryModel.find({ ancestors: root._id })
    .sort({ depth: 1 })
    .exec();

  const cache = new Map<string, { path: string; ancestors: Types.ObjectId[]; depth: number }>();
  cache.set(root._id.toString(), {
    path: root.path,
    ancestors: (root.ancestors ?? []) as Types.ObjectId[],
    depth: root.depth,
  });

  const updates: Array<{ updateOne: { filter: { _id: Types.ObjectId }; update: { $set: { path: string; ancestors: Types.ObjectId[]; depth: number } } } }> = [];

  for (const category of descendants) {
    const parentId = category.parentId ? category.parentId.toString() : undefined;
    if (!parentId) {
      continue;
    }

    if (!cache.has(parentId)) {
      const parentDoc = await BlogCategoryModel.findById(parentId).exec();
      if (!parentDoc) {
        continue;
      }
      cache.set(parentId, {
        path: parentDoc.path,
        ancestors: (parentDoc.ancestors ?? []) as Types.ObjectId[],
        depth: parentDoc.depth,
      });
    }

    const parentInfo = cache.get(parentId)!;
    const newAncestors = [...parentInfo.ancestors, new Types.ObjectId(parentId)];
    const newPath = `${parentInfo.path}/${category.slug}`;
    const newDepth = parentInfo.depth + 1;

    cache.set(category._id.toString(), {
      path: newPath,
      ancestors: newAncestors,
      depth: newDepth,
    });

    updates.push({
      updateOne: {
        filter: { _id: category._id },
        update: { $set: { path: newPath, ancestors: newAncestors, depth: newDepth } },
      },
    });
  }

  if (updates.length > 0) {
    await BlogCategoryModel.bulkWrite(updates);
  }
}

export async function updateCategory(id: string, input: CategoryUpdateInput) {
  const category = await BlogCategoryModel.findById(id);
  if (!category) {
    throw new Error('category_not_found');
  }

  const previousPath = category.path;

  const parentChanged =
    typeof input.parentId !== 'undefined' &&
    (input.parentId ? category.parentId?.toString() !== input.parentId : category.parentId !== null);
  const slugChanged = typeof input.slug === 'string' && input.slug !== category.slug;

  if (typeof input.name === 'string') {
    category.name = input.name;
  }
  if (typeof input.slug === 'string') {
    category.slug = input.slug;
  }
  if (typeof input.position === 'number') {
    category.position = input.position;
  }
  if (typeof input.isActive === 'boolean') {
    category.isActive = input.isActive;
  }
  if (typeof input.seo !== 'undefined') {
    category.set('seo', input.seo);
  }

  if (parentChanged) {
    const newParentId = input.parentId ? new Types.ObjectId(input.parentId) : null;
    category.set('parentId', newParentId);
  }

  if (parentChanged || slugChanged) {
    const parent = await fetchParent(category.parentId ? category.parentId.toString() : null);
    category.ancestors = buildAncestors(parent ?? undefined);
    category.depth = category.ancestors.length;
    category.path = buildPath(category.slug, parent ?? undefined);
  }

  await category.save();
  const newPath = category.path;

  if (parentChanged || slugChanged) {
    await cascadePaths(category);
  }
  await revalidateBlogCategoryCaches(newPath ? [newPath] : [], previousPath && previousPath !== newPath ? [previousPath] : []);
}

export async function deleteCategory(id: string) {
  const childCount = await BlogCategoryModel.countDocuments({ parentId: id });
  if (childCount > 0) {
    throw new Error('category_has_children');
  }

  const postExists = await BlogPostModel.exists({ categories: id });
  if (postExists) {
    throw new Error('category_in_use');
  }

  const category = await BlogCategoryModel.findById(id).lean();
  await BlogCategoryModel.findByIdAndDelete(id).exec();
  await revalidateBlogCategoryCaches([], category?.path ? [category.path] : []);
}

export async function subtreeIds(rootId: string): Promise<string[]> {
  const ids = await BlogCategoryModel.find(
    { $or: [{ _id: rootId }, { ancestors: rootId }] },
    { _id: 1 }
  )
    .lean()
    .exec();

  return ids.map((doc) => doc._id.toString());
}

export async function listCategories(parentId?: string | null) {
  const filter: Record<string, unknown> = {};
  if (typeof parentId !== 'undefined') {
    filter.parentId = parentId;
  }
  return BlogCategoryModel.find(filter).sort({ position: 1, name: 1 }).lean();
}

export async function getCategoryWithBreadcrumb(id: string) {
  const category = await BlogCategoryModel.findById(id).lean();
  if (!category) {
    return null;
  }
  const ancestors = category.ancestors?.length
    ? await BlogCategoryModel.find({ _id: { $in: category.ancestors } })
        .sort({ depth: 1 })
        .lean()
    : [];
  return { category, ancestors };
}
