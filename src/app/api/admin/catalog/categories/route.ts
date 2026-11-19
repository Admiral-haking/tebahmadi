import { NextRequest, NextResponse } from 'next/server';

import CategoryModel from '@/catalog/models/Category';
import ProductTypeModel from '@/catalog/models/ProductType';
import { connectMongoose } from '@/lib/mongoose';
import { jsonError } from '@/lib/http';
import { Types } from 'mongoose';

type CategoryListItem = {
  id: string;
  name: string;
  slug: string;
  path: string;
  depth: number;
  parentId?: string | null;
  isActive: boolean;
  position?: number;
  childCount: number;
  updatedAt?: string;
  productTypeId?: string | null;
  effectiveProductTypeId?: string | null;
  productTypeName?: string | null;
  productTypeInherited: boolean;
  imageId?: string | null;
  mediaId?: string | null;
};

function buildFilter(q?: string | null): Record<string, unknown> {
  if (!q) {
    return {};
  }
  const trimmed = q.trim();
  if (!trimmed) {
    return {};
  }
  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(escaped, 'i');
  return {
    $or: [{ name: regex }, { slug: regex }, { path: regex }],
  };
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    await connectMongoose();
    const params = req.nextUrl.searchParams;
    const q = params.get('q');

    const parentId = params.get('parentId') ?? undefined;

    const filter = buildFilter(q ?? undefined);

    if (parentId === "root")
      filter.parentId = null;
    else if (parentId?.trim() && Types.ObjectId.isValid(parentId))
      filter.parentId = new Types.ObjectId(parentId);

    const categories = await CategoryModel.find(filter).sort({ depth: 1, position: 1, name: 1 }).lean();

    const childCountMap = new Map<string, number>();
    categories.forEach((category) => {
      const parent = category.parentId ? category.parentId.toString() : null;
      if (!parent) return;
      childCountMap.set(parent, (childCountMap.get(parent) ?? 0) + 1);
    });

    const categoryMap = new Map<string, typeof categories[number]>();
    categories.forEach((category) => {
      categoryMap.set(category._id.toString(), category);
    });

    const effectiveProductTypeCache = new Map<string, string | null>();

    function resolveEffectiveProductType(categoryId: string): string | null {
      if (effectiveProductTypeCache.has(categoryId)) {
        return effectiveProductTypeCache.get(categoryId) ?? null;
      }
      const category = categoryMap.get(categoryId);
      if (!category) {
        effectiveProductTypeCache.set(categoryId, null);
        return null;
      }
      const direct = category.productTypeId ? category.productTypeId.toString() : null;
      if (direct) {
        effectiveProductTypeCache.set(categoryId, direct);
        return direct;
      }
      const parentId = category.parentId ? category.parentId.toString() : null;
      if (!parentId) {
        effectiveProductTypeCache.set(categoryId, null);
        return null;
      }
      const resolved = resolveEffectiveProductType(parentId);
      effectiveProductTypeCache.set(categoryId, resolved);
      return resolved;
    }

    const referencedProductTypeIds = new Set<string>();
    categories.forEach((category) => {
      const id = category._id.toString();
      const direct = category.productTypeId ? category.productTypeId.toString() : null;
      const effective = resolveEffectiveProductType(id);
      if (direct) referencedProductTypeIds.add(direct);
      if (effective) referencedProductTypeIds.add(effective);
    });

    const productTypeRows = referencedProductTypeIds.size
      ? await ProductTypeModel.find(
        { _id: { $in: Array.from(referencedProductTypeIds) } },
        { name: 1 },
      )
        .lean()
        .exec()
      : [];
    const productTypeMap = new Map(
      productTypeRows.map((type) => [type._id.toString(), type.name ?? '-']),
    );

    const list: CategoryListItem[] = categories.map((category) => {
      const id = category._id.toString();
      const directProductTypeId = category.productTypeId ? category.productTypeId.toString() : null;
      const effectiveProductTypeId = resolveEffectiveProductType(id);
      const productTypeName = effectiveProductTypeId ? productTypeMap.get(effectiveProductTypeId) ?? null : null;
      return {
        id,
        name: category.name,
        slug: category.slug,
        path: category.path,
        depth: category.depth ?? 0,
        parentId: category.parentId ? category.parentId.toString() : null,
        isActive: category.isActive ?? true,
        position: category.position ?? undefined,
        childCount: childCountMap.get(id) ?? 0,
        updatedAt: category.updatedAt ? category.updatedAt.toISOString() : undefined,
        productTypeId: directProductTypeId,
        effectiveProductTypeId,
        productTypeName,
        productTypeInherited: Boolean(
          effectiveProductTypeId && effectiveProductTypeId !== directProductTypeId,
        ),
        imageId: category.imageId ? category.imageId.toString() : null,
        mediaId: category.mediaId ? category.mediaId.toString() : null,
      };
    });

    return NextResponse.json({ categories: list });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load categories';
    return jsonError(500, message);
  }
}
