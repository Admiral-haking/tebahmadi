import { NextRequest, NextResponse } from "next/server";
import { loadStoreProducts } from "@/views/store/components/product-loader";
import type { RawSearchParams } from "@/views/store/components/search-params";

export const runtime = "nodejs";

function fromUrlSearchParams(params: URLSearchParams): RawSearchParams {
    const result: RawSearchParams = {};
    params.forEach((value, key) => {
        const normalized = `${value}`;
        if (result[key] === undefined) {
            result[key] = normalized;
            return;
        }
        const existing = result[key];
        if (Array.isArray(existing)) {
            existing.push(normalized);
        } else {
            result[key] = [existing, normalized];
        }
    });
    return result;
}

export async function GET(req: NextRequest) {
    try {
        const params = fromUrlSearchParams(req.nextUrl.searchParams);
        const normalizedParams: RawSearchParams = { ...params };

        const rawCategoryId = normalizedParams.categoryId;
        const rawProductTypeId = normalizedParams.productTypeId;
        delete normalizedParams.categoryId;
        delete normalizedParams.productTypeId;

        const activeCategoryId = Array.isArray(rawCategoryId) ? rawCategoryId[0] : rawCategoryId;
        const productTypeIds = Array.isArray(rawProductTypeId)
            ? rawProductTypeId
            : rawProductTypeId
                ? [rawProductTypeId]
                : [];

        if (!activeCategoryId) {
            return NextResponse.json({ error: "Missing category context" }, { status: 400 });
        }

        const { products, pages, currentPage, total } = await loadStoreProducts(normalizedParams, {
            activeCategoryId,
            productTypeIds: productTypeIds
                .map((value) => `${value}`.trim())
                .filter((value) => value.length > 0),
        });
        return NextResponse.json({
            products,
            pages,
            page: currentPage,
            total,
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load products";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
