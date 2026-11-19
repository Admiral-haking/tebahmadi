"use server";

import { Types, type FilterQuery } from "mongoose";

import { connectMongoose } from "@/lib/mongoose";
import { BlogPostModel, type BlogPostDocument } from "@/content/models/BlogPost";
import { BlogCategoryModel, type BlogCategoryDocument } from "@/content/models/BlogCategory";
import MediaModel from "@/models/Media";
import { subtreeIds } from "@/content/services/categoryService";
import { buildMediaPath } from "@/seo/utils/url";

const PAGE_SIZE = 9;

type RawSearchParams = Record<string, string | string[] | undefined>;

export type BlogViewSearchParams = RawSearchParams;

export type BlogCategoryItem = {
    id: string;
    name: string;
    slug: string;
    path: string;
    depth: number;
    parentId: string | null;
    count: number;
};

export type BlogPostListItem = {
    id: string;
    slug: string;
    title: string;
    excerpt: string | null;
    publishedAt: string | null;
    coverImageUrl: string | null;
    tags: string[];
    categories: Array<Pick<BlogCategoryItem, "id" | "name" | "slug" | "path">>;
};

export type BlogIndexData = {
    searchTerm: string;
    page: number;
    pages: number;
    total: number;
    pageSize: number;
    posts: BlogPostListItem[];
    categories: BlogCategoryItem[];
    selectedCategory: BlogCategoryItem | null;
    allPostsCount: number;
};

function singleValue(value: string | string[] | undefined): string | undefined {
    if (Array.isArray(value)) {
        return value[0];
    }
    return value;
}

function parsePage(value: string | string[] | undefined): number {
    const raw = singleValue(value);
    if (!raw) return 1;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed < 1) {
        return 1;
    }
    return Math.floor(parsed);
}

function toObjectId(value: string | undefined): Types.ObjectId | undefined {
    if (!value) return undefined;
    return Types.ObjectId.isValid(value) ? new Types.ObjectId(value) : undefined;
}

function normalizeCategories(
    docs: Array<Pick<BlogCategoryDocument, "_id" | "name" | "slug" | "path" | "depth" | "parentId">>,
    counts: Map<string, number>,
): BlogCategoryItem[] {
    return docs
        .map((doc) => {
            const id = doc._id?.toString();
            if (!id) return null;
            const name = typeof doc.name === "string" ? doc.name.trim() : "";
            if (!name) return null;
            const slug = typeof doc.slug === "string" ? doc.slug : "";
            const path = typeof doc.path === "string" && doc.path.length ? doc.path : slug;
            const count = counts.get(id) ?? 0;
            return {
                id,
                name,
                slug,
                path,
                depth: typeof doc.depth === "number" ? doc.depth : 0,
                parentId: doc.parentId ? doc.parentId.toString() : null,
                count,
            } satisfies BlogCategoryItem;
        })
        .filter((value): value is BlogCategoryItem => Boolean(value));
}

type MediaSummary = {
    originalId?: string;
    mobileId?: string;
    thumbId?: string;
};

type PostsQueryResult = Array<
    Pick<
        BlogPostDocument,
        "_id" | "slug" | "title" | "excerpt" | "coverImageId" | "categories" | "publishedAt" | "tags"
    >
>;

function mapPosts(
    posts: PostsQueryResult,
    categories: Map<string, BlogCategoryItem>,
    media: Map<string, MediaSummary>,
): BlogPostListItem[] {
    return posts.map((post) => {
        const id = post._id?.toString() ?? "";
        const coverImageId = post.coverImageId ? post.coverImageId.toString() : undefined;
        const mediaSummary = coverImageId ? media.get(coverImageId) : undefined;
        const coverCandidate =
            mediaSummary?.mobileId ?? mediaSummary?.thumbId ?? mediaSummary?.originalId ?? undefined;
        const categorySummaries = (Array.isArray(post.categories) ? post.categories : [])
            .map((categoryId) => {
                const idString = typeof categoryId === "string" ? categoryId : categoryId?.toString();
                if (!idString) return null;
                const category = categories.get(idString);
                if (!category) return null;
                return {
                    id: category.id,
                    name: category.name,
                    slug: category.slug,
                    path: category.path,
                };
            })
            .filter((value): value is BlogPostListItem["categories"][number] => Boolean(value));

        return {
            id,
            slug: post.slug ?? "",
            title: post.title ?? "",
            excerpt: typeof post.excerpt === "string" ? post.excerpt : null,
            publishedAt: post.publishedAt instanceof Date ? post.publishedAt.toISOString() : null,
            coverImageUrl: coverCandidate ? buildMediaPath(coverCandidate) : null,
            tags: Array.isArray(post.tags) ? post.tags.filter((tag): tag is string => typeof tag === "string") : [],
            categories: categorySummaries,
        };
    });
}

export async function loadBlogIndex(searchParams: RawSearchParams): Promise<BlogIndexData> {
    await connectMongoose();

    const page = parsePage(searchParams.page);
    const searchTerm = (singleValue(searchParams.q) ?? "").trim();
    const categoryParam = (singleValue(searchParams.category) ?? "").trim();

    const baseMatch: FilterQuery<BlogPostDocument> = {
        status: "published",
    };

    if (searchTerm) {
        baseMatch.$text = { $search: searchTerm };
    }

    const categoriesPromise = BlogCategoryModel.find({ isActive: true })
        .sort({ depth: 1, position: 1, name: 1 })
        .select({ name: 1, slug: 1, path: 1, depth: 1, parentId: 1 })
        .lean();

    const [categoryDocs, categoryCountDocs] = await Promise.all([
        categoriesPromise,
        BlogPostModel.aggregate<{ _id: Types.ObjectId; count: number }>([
            { $match: { status: "published" } },
            { $unwind: "$categories" },
            { $group: { _id: "$categories", count: { $sum: 1 } } },
        ]),
    ]);

    const categoryCounts = new Map<string, number>();
    for (const entry of categoryCountDocs) {
        const id = entry._id?.toString();
        if (!id) continue;
        categoryCounts.set(id, entry.count ?? 0);
    }

    const allCategories = normalizeCategories(categoryDocs, categoryCounts);
    const categoryMap = new Map(allCategories.map((category) => [category.id, category]));

    let selectedCategory: BlogCategoryItem | null = null;
    if (categoryParam) {
        selectedCategory =
            allCategories.find((category) => category.path === categoryParam || category.id === categoryParam) ?? null;
    }

    let categoryFilterIds: Types.ObjectId[] | undefined;
    if (selectedCategory) {
        const ids = await subtreeIds(selectedCategory.id);
        const idsWithSelf = new Set(ids);
        idsWithSelf.add(selectedCategory.id);
        const resolvedIds = Array.from(idsWithSelf)
            .map((id) => toObjectId(id))
            .filter((value): value is Types.ObjectId => Boolean(value));
        if (resolvedIds.length > 0) {
            categoryFilterIds = resolvedIds;
        }
    }

    const query: FilterQuery<BlogPostDocument> = { ...baseMatch };
    if (categoryFilterIds) {
        query.categories = { $in: categoryFilterIds };
    }

    const skip = (page - 1) * PAGE_SIZE;

    const [posts, totalMatching, totalPublished] = await Promise.all([
        BlogPostModel.find(query)
            .sort(
                searchTerm
                    ? { score: { $meta: "textScore" }, publishedAt: -1, createdAt: -1 }
                    : { publishedAt: -1, createdAt: -1 },
            )
            .skip(skip)
            .limit(PAGE_SIZE)
            .select({
                title: 1,
                slug: 1,
                excerpt: 1,
                coverImageId: 1,
                categories: 1,
                publishedAt: 1,
                tags: 1,
                ...(searchTerm ? { score: { $meta: "textScore" } } : {}),
            })
            .lean() as Promise<PostsQueryResult>,
        BlogPostModel.countDocuments(query),
        BlogPostModel.countDocuments({ status: "published" }),
    ]);

    const coverImageIds = posts
        .map((post) => {
            if (!post.coverImageId) return null;
            return post.coverImageId instanceof Types.ObjectId ? post.coverImageId : toObjectId(`${post.coverImageId}`);
        })
        .filter((value): value is Types.ObjectId => Boolean(value));

    const mediaDocs = coverImageIds.length
        ? await MediaModel.find(
            { _id: { $in: coverImageIds } },
            { originalId: 1, mobileId: 1, thumbId: 1 },
        ).lean()
        : [];

    const mediaMap = new Map<string, MediaSummary>();
    for (const doc of mediaDocs) {
        const id = doc._id?.toString();
        if (!id) continue;
        mediaMap.set(id, {
            originalId: doc.originalId instanceof Types.ObjectId ? doc.originalId.toString() : undefined,
            mobileId: doc.mobileId instanceof Types.ObjectId ? doc.mobileId.toString() : undefined,
            thumbId: doc.thumbId instanceof Types.ObjectId ? doc.thumbId.toString() : undefined,
        });
    }

    const postItems = mapPosts(posts, categoryMap, mediaMap);
    const pages = totalMatching > 0 ? Math.ceil(totalMatching / PAGE_SIZE) : 1;

    return {
        searchTerm,
        page,
        pages,
        total: totalMatching,
        pageSize: PAGE_SIZE,
        posts: postItems,
        categories: allCategories,
        selectedCategory,
        allPostsCount: totalPublished,
    };
}

type BlogPostDetailQuery = Pick<
    BlogPostDocument,
    "_id" | "slug" | "title" | "excerpt" | "content" | "coverImageId" | "categories" | "tags" | "publishedAt" | "updatedAt" | "seo"
>;

export type BlogPostDetail = {
    id: string;
    slug: string;
    title: string;
    excerpt: string | null;
    content: string;
    publishedAt: string | null;
    updatedAt: string | null;
    coverImageUrl: string | null;
    tags: string[];
    categories: Array<Pick<BlogCategoryItem, "id" | "name" | "slug" | "path">>;
    seo: BlogPostDocument["seo"];
};

export type RelatedPost = Pick<BlogPostListItem, "id" | "slug" | "title" | "coverImageUrl" | "publishedAt">;

export type BlogPostData = {
    post: BlogPostDetail;
    related: RelatedPost[];
};

function buildPostDetail(
    post: BlogPostDetailQuery | null,
    categoryMap: Map<string, BlogCategoryItem>,
    mediaMap: Map<string, MediaSummary>,
): BlogPostDetail | null {
    if (!post) return null;
    const id = post._id?.toString();
    if (!id) return null;
    const coverId = post.coverImageId ? post.coverImageId.toString() : undefined;
    const mediaSummary = coverId ? mediaMap.get(coverId) : undefined;
    const coverCandidate =
        mediaSummary?.mobileId ?? mediaSummary?.originalId ?? mediaSummary?.thumbId ?? undefined;

    const categories = (Array.isArray(post.categories) ? post.categories : [])
        .map((categoryId) => {
            const key = typeof categoryId === "string" ? categoryId : categoryId?.toString();
            if (!key) return null;
            const category = categoryMap.get(key);
            if (!category) return null;
            return {
                id: category.id,
                name: category.name,
                slug: category.slug,
                path: category.path,
            };
        })
        .filter((value): value is BlogPostDetail["categories"][number] => Boolean(value));

    return {
        id,
        slug: post.slug ?? "",
        title: post.title ?? "",
        excerpt: typeof post.excerpt === "string" ? post.excerpt : null,
        content: typeof post.content === "string" ? post.content : "",
        publishedAt: post.publishedAt instanceof Date ? post.publishedAt.toISOString() : null,
        updatedAt: post.updatedAt instanceof Date ? post.updatedAt.toISOString() : null,
        coverImageUrl: coverCandidate ? buildMediaPath(coverCandidate) : null,
        tags: Array.isArray(post.tags) ? post.tags.filter((tag): tag is string => typeof tag === "string") : [],
        categories,
        seo: post.seo,
    };
}

export async function loadBlogPost(slug: string): Promise<BlogPostData | null> {
    if (!slug) return null;

    await connectMongoose();

    const postDoc = await BlogPostModel.findOne({ slug, status: "published" })
        .select({
            title: 1,
            slug: 1,
            excerpt: 1,
            coverImageId: 1,
            content: 1,
            categories: 1,
            tags: 1,
            publishedAt: 1,
            updatedAt: 1,
            seo: 1,
        })
        .lean() as BlogPostDetailQuery | null;

    if (!postDoc?._id) {
        return null;
    }

    const categoryIds = Array.isArray(postDoc.categories) ? postDoc.categories : [];
    const categoryObjectIds = categoryIds
        .map((id) => (id instanceof Types.ObjectId ? id : toObjectId(`${id}`)))
        .filter((value): value is Types.ObjectId => Boolean(value));

    const [categoryDocs, coverMediaDoc, relatedPostsDocs] = await Promise.all([
        BlogCategoryModel.find({ _id: { $in: categoryObjectIds } })
            .select({ name: 1, slug: 1, path: 1, depth: 1, parentId: 1 })
            .lean(),
        postDoc.coverImageId
            ? MediaModel.find({ _id: postDoc.coverImageId }, { originalId: 1, mobileId: 1, thumbId: 1 }).lean()
            : [],
        BlogPostModel.find({
            _id: { $ne: postDoc._id },
            status: "published",
            ...(categoryObjectIds.length
                ? { categories: { $in: categoryObjectIds } }
                : {}),
        })
            .sort({ publishedAt: -1, createdAt: -1 })
            .limit(4)
            .select({ title: 1, slug: 1, coverImageId: 1, publishedAt: 1 })
            .lean(),
    ]);

    const categoryMap = new Map(
        normalizeCategories(categoryDocs, new Map<string, number>()).map((category) => [category.id, category]),
    );

    const mediaMap = new Map<string, MediaSummary>();
    for (const doc of coverMediaDoc) {
        const id = doc._id?.toString();
        if (!id) continue;
        mediaMap.set(id, {
            originalId: doc.originalId instanceof Types.ObjectId ? doc.originalId.toString() : undefined,
            mobileId: doc.mobileId instanceof Types.ObjectId ? doc.mobileId.toString() : undefined,
            thumbId: doc.thumbId instanceof Types.ObjectId ? doc.thumbId.toString() : undefined,
        });
    }

    const post = buildPostDetail(postDoc, categoryMap, mediaMap);
    if (!post) {
        return null;
    }

    const relatedCoverIds = relatedPostsDocs
        .map((doc) => {
            if (!doc.coverImageId) return null;
            return doc.coverImageId instanceof Types.ObjectId ? doc.coverImageId : toObjectId(`${doc.coverImageId}`);
        })
        .filter((value): value is Types.ObjectId => Boolean(value));

    const relatedMediaDocs = relatedCoverIds.length
        ? await MediaModel.find({ _id: { $in: relatedCoverIds } }, { originalId: 1, mobileId: 1, thumbId: 1 }).lean()
        : [];

    const relatedMediaMap = new Map<string, MediaSummary>();
    for (const doc of relatedMediaDocs) {
        const id = doc._id?.toString();
        if (!id) continue;
        relatedMediaMap.set(id, {
            originalId: doc.originalId instanceof Types.ObjectId ? doc.originalId.toString() : undefined,
            mobileId: doc.mobileId instanceof Types.ObjectId ? doc.mobileId.toString() : undefined,
            thumbId: doc.thumbId instanceof Types.ObjectId ? doc.thumbId.toString() : undefined,
        });
    }

    const related: RelatedPost[] = relatedPostsDocs.map((doc) => {
        const coverId = doc.coverImageId ? doc.coverImageId.toString() : undefined;
        const mediaSummary = coverId ? relatedMediaMap.get(coverId) : undefined;
        const coverCandidate =
            mediaSummary?.mobileId ?? mediaSummary?.thumbId ?? mediaSummary?.originalId ?? undefined;
        return {
            id: doc._id?.toString() ?? "",
            slug: doc.slug ?? "",
            title: doc.title ?? "",
            publishedAt: doc.publishedAt instanceof Date ? doc.publishedAt.toISOString() : null,
            coverImageUrl: coverCandidate ? buildMediaPath(coverCandidate) : null,
        };
    });

    return {
        post,
        related,
    };
}
