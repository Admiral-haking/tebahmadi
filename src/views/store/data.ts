"use server";

import { unstable_cache } from "next/cache";
import { Types } from "mongoose";

import CategoryModel from "@/catalog/models/Category";
import ProductTypeModel from "@/catalog/models/ProductType";
import type { AttributeDef } from "@/catalog/models/ProductType";
import { connectMongoose } from "@/lib/mongoose";
import MediaModel from "@/models/Media";

export type StoreFilterAttributeOption = {
    value: string;
    label: string;
    swatches?: string[];
};

export type StoreFilterAttribute = {
    key: string;
    label: string;
    kind: "enum" | "multi-enum" | "color";
    options: StoreFilterAttributeOption[];
};

export type StoreProductTypeContext = {
    id: string;
    name: string;
    attributes: StoreFilterAttribute[];
};

export type StoreCategorySummary = {
    id: string;
    name: string;
    slug: string;
    path: string;
    depth: number;
    parentId: string | null;
    imageId?: string | null;
    mediaId?: string | null;
};

export type StoreCategoryContext = {
    root: StoreCategorySummary & {
        seoTitle?: string;
        seoDescription?: string;
    };
    active: StoreCategorySummary;
    breadcrumbs: StoreCategorySummary[];
    children: StoreCategorySummary[];
    productTypes: StoreProductTypeContext[];
    filterAttributes: StoreFilterAttribute[];
    productTypeIds: string[];
    mediaId?: string;
};

function toObjectIdString(value: Types.ObjectId | string | null | undefined): string | null {
    if (!value) return null;
    return typeof value === "string" ? value : value.toString();
}

function toCategorySummary(category: {
    _id: Types.ObjectId;
    name?: string | null;
    slug?: string | null;
    path?: string | null;
    depth?: number | null;
    parentId?: Types.ObjectId | string | null;
    imageId?: Types.ObjectId | string | null;
    mediaId?: Types.ObjectId | string | null;
}): StoreCategorySummary {
    return {
        id: category._id.toString(),
        name: category.name ?? "",
        slug: category.slug ?? "",
        path: category.path ?? "",
        depth: category.depth ?? 0,
        parentId: toObjectIdString(category.parentId),
        imageId: toObjectIdString(category.imageId),
        mediaId: toObjectIdString(category.mediaId),
    };
}

function buildFilterAttributes(attributes: AttributeDef[] | undefined): StoreFilterAttribute[] {
    if (!Array.isArray(attributes)) return [];
    return attributes
        .filter((attr) => attr && attr.filterable && ["enum", "multi-enum", "color"].includes(attr.kind))
        .map((attr) => {
            if (attr.kind === "color") {
                const values = Array.isArray(attr.values) ? attr.values : [];
                const options = values
                    .filter((value) => value && value.active !== false)
                    .map((value) => ({
                        value: value.key,
                        label: value.name,
                        swatches: Array.isArray(value.swatches) ? value.swatches : [],
                    }))
                    .filter((option) => option.value && option.label);
                return {
                    key: attr.key,
                    label: attr.label,
                    kind: attr.kind,
                    options,
                } satisfies StoreFilterAttribute;
            }

            const enumValues = Array.isArray(attr.enumValues) ? attr.enumValues : [];
            const options = enumValues
                .map((value) => ({ value, label: value }))
                .filter((option) => option.value && option.label);
            return {
                key: attr.key,
                label: attr.label,
                kind: attr.kind as "enum" | "multi-enum",
                options,
            } satisfies StoreFilterAttribute;
        })
        .filter((attr) => attr.options.length > 0);
}

function mergeFilterAttributes(productTypes: StoreProductTypeContext[]): StoreFilterAttribute[] {
    const map = new Map<
        string,
        {
            key: string;
            label: string;
            kind: StoreFilterAttribute["kind"];
            options: Map<string, StoreFilterAttributeOption>;
        }
    >();

    productTypes.forEach((type) => {
        type.attributes.forEach((attribute) => {
            const existing = map.get(attribute.key);
            if (!existing) {
                map.set(attribute.key, {
                    key: attribute.key,
                    label: attribute.label,
                    kind: attribute.kind,
                    options: new Map(attribute.options.map((option) => [option.value, option])),
                });
                return;
            }

            // If the kind differs we skip merging to avoid inconsistent filters
            if (existing.kind !== attribute.kind) {
                return;
            }

            attribute.options.forEach((option) => {
                if (!existing.options.has(option.value)) {
                    existing.options.set(option.value, option);
                }
            });
        });
    });

    return Array.from(map.values())
        .map((entry) => ({
            key: entry.key,
            label: entry.label,
            kind: entry.kind,
            options: Array.from(entry.options.values()).sort((a, b) => a.label.localeCompare(b.label, "fa")),
        }))
        .sort((a, b) => a.label.localeCompare(b.label, "fa"));
}

function normalizeSegments(segments: string[]): string[] {
    return segments
        .map((segment) => segment.trim())
        .filter((segment) => segment.length > 0);
}

function ensureHasProductTypes(ids: Set<string>) {
    if (!ids.size) {
        throw new Error("No product types configured for this category");
    }
}

export async function loadStoreCategoryContext(slugSegments: string[]): Promise<StoreCategoryContext> {
    await connectMongoose();

    const segments = normalizeSegments(slugSegments);
    if (segments.length === 0) {
        throw new Error("Category path is required");
    }

    const rootSlug = segments[0];
    const activePath = segments.join("/");

    const rootCategory = await CategoryModel.findOne(
        { path: rootSlug, isActive: true },
        { name: 1, slug: 1, path: 1, depth: 1, parentId: 1, imageId: 1, mediaId: 1, productTypeId: 1, seoTitle: 1, seoDescription: 1, ancestors: 1 },
    )
        .lean()
        .exec();
    if (!rootCategory) {
        throw new Error("Category not found");
    }

    let activeCategory = rootCategory;
    if (segments.length > 1) {
        const resolved = await CategoryModel.findOne(
            { path: activePath, isActive: true },
            { name: 1, slug: 1, path: 1, depth: 1, parentId: 1, imageId: 1, mediaId: 1, productTypeId: 1, ancestors: 1 },
        )
            .lean()
            .exec();
        if (!resolved) {
            throw new Error("Category not found");
        }
        activeCategory = resolved;
    }

    const rootId = rootCategory._id.toString();
    const activeId = activeCategory._id.toString();

    if (activeId !== rootId) {
        const ancestorIds = (activeCategory.ancestors ?? []).map((id) => id.toString());
        if (!ancestorIds.includes(rootId)) {
            throw new Error("Category not found");
        }
    }

    const breadcrumbIds = [
        ...(activeCategory.ancestors ?? []).map((id) => id.toString()),
        activeId,
    ];
    const uniqueBreadcrumbIds = Array.from(new Set(breadcrumbIds));

    const breadcrumbDocs = uniqueBreadcrumbIds.length
        ? await CategoryModel.find(
            { _id: { $in: uniqueBreadcrumbIds } },
            { name: 1, slug: 1, path: 1, depth: 1, parentId: 1, imageId: 1, mediaId: 1, productTypeId: 1 },
        )
            .lean()
            .exec()
        : [];

    const breadcrumbMap = new Map(breadcrumbDocs.map((doc) => [doc._id.toString(), doc]));
    breadcrumbMap.set(rootId, rootCategory);
    breadcrumbMap.set(activeId, activeCategory);

    const breadcrumbs: StoreCategorySummary[] = uniqueBreadcrumbIds
        .map((id) => breadcrumbMap.get(id))
        .filter((doc): doc is typeof breadcrumbDocs[number] => Boolean(doc))
        .sort((a, b) => (a.depth ?? 0) - (b.depth ?? 0))
        .map((doc) => toCategorySummary(doc));

    const subtreeDocs = await CategoryModel.find(
        {
            isActive: true,
            $or: [{ _id: activeCategory._id }, { ancestors: activeCategory._id }],
        },
        { name: 1, slug: 1, path: 1, depth: 1, parentId: 1, imageId: 1, mediaId: 1, productTypeId: 1, ancestors: 1 },
    )
        .lean()
        .exec();

    const categoryMap = new Map<string, typeof rootCategory>();
    const register = (doc: typeof rootCategory | typeof activeCategory) => {
        categoryMap.set(doc._id.toString(), doc);
    };

    register(rootCategory);
    register(activeCategory);
    breadcrumbDocs.forEach(register);
    subtreeDocs.forEach(register);

    const resolveProductTypeId = (doc: typeof rootCategory | typeof activeCategory): string | null => {
        if (doc.productTypeId) {
            return doc.productTypeId.toString();
        }
        const ancestors = Array.isArray(doc.ancestors) ? doc.ancestors : [];
        for (let index = ancestors.length - 1; index >= 0; index -= 1) {
            const ancestorId = ancestors[index]?.toString();
            if (!ancestorId) continue;
            const ancestorDoc = categoryMap.get(ancestorId);
            if (ancestorDoc?.productTypeId) {
                return ancestorDoc.productTypeId.toString();
            }
        }
        return null;
    };

    const productTypeIds = new Set<string>();
    subtreeDocs.forEach((doc) => {
        const typeId = resolveProductTypeId(doc);
        if (typeId) {
            productTypeIds.add(typeId);
        }
    });

    const activeTypeId = resolveProductTypeId(activeCategory);
    if (activeTypeId) {
        productTypeIds.add(activeTypeId);
    }

    ensureHasProductTypes(productTypeIds);

    const productTypeDocs = await ProductTypeModel.find(
        { _id: { $in: Array.from(productTypeIds) } },
        { name: 1, attributes: 1 },
    )
        .lean()
        .exec();

    const productTypes: StoreProductTypeContext[] = productTypeDocs
        .map((doc) => ({
            id: doc._id.toString(),
            name: doc.name ?? "",
            attributes: buildFilterAttributes(doc.attributes),
        }))
        .sort((a, b) => a.name.localeCompare(b.name, "fa"));

    const filterAttributes = mergeFilterAttributes(productTypes);

    const childrenDocs = await CategoryModel.find(
        { parentId: activeCategory._id, isActive: true },
        { name: 1, slug: 1, path: 1, depth: 1, parentId: 1, imageId: 1, mediaId: 1 },
    )
        .sort({ position: 1, name: 1 })
        .lean()
        .exec();

    const children = childrenDocs.map((doc) => toCategorySummary(doc));

    let activeMediaId: string | undefined;
    const rawActiveMediaId =
        typeof activeCategory.mediaId === "string"
            ? activeCategory.mediaId
            : activeCategory.mediaId
                ? activeCategory.mediaId.toString()
                : undefined;
    if (rawActiveMediaId) {
        if (Types.ObjectId.isValid(rawActiveMediaId)) {
            const mediaDoc = await MediaModel.findById(rawActiveMediaId, {
                mobileId: 1,
                thumbId: 1,
            })
                .lean()
                .exec();
            activeMediaId =
                mediaDoc?.mobileId?.toString() ??
                mediaDoc?.thumbId?.toString() ??
                mediaDoc?._id?.toString() ??
                rawActiveMediaId;
        } else {
            activeMediaId = rawActiveMediaId;
        }
    }

    return {
        root: {
            ...toCategorySummary(rootCategory),
            seoTitle: rootCategory.seoTitle ?? undefined,
            seoDescription: rootCategory.seoDescription ?? undefined,
        },
        active: toCategorySummary(activeCategory),
        breadcrumbs,
        children,
        productTypes,
        filterAttributes,
        productTypeIds: Array.from(productTypeIds),
        mediaId: activeMediaId,
    };
}

const loadRootCategoriesCached = unstable_cache(
    async (): Promise<StoreCategorySummary[]> => {
        await connectMongoose();
        const roots = await CategoryModel.find(
            { parentId: null, isActive: true },
            { name: 1, slug: 1, path: 1, depth: 1, parentId: 1, imageId: 1, mediaId: 1 },
        )
            .sort({ position: 1, name: 1 })
            .lean()
            .exec();
        return roots.map((doc) => toCategorySummary(doc));
    },
    ["root-categories-v2"],
    { tags: ["category-tree", "catalog"] },
);

export async function loadRootCategories(): Promise<StoreCategorySummary[]> {
    return loadRootCategoriesCached();
}
