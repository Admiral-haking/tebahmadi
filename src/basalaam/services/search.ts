import { POST } from "@/utils/fetch";
import { bslApiRoutes } from "../constants/route";

/**
 * Basalam product search (SDK docs section 8). Public search service; no vendor
 * auth required. filters mirror ProductSearchModel/FiltersModel from the docs.
 */
export type BslSearchFilters = {
    freeShipping?: 0 | 1;
    slug?: string;
    vendorIdentifier?: string;
    maxPrice?: number;
    minPrice?: number;
    sameCity?: 0 | 1;
    minRating?: number;
    vendorScore?: 0 | 1;
};

export type BslSearchResultItem = {
    id: number;
    name: string;
    price: number;
    stock: number;
    categoryId: number;
    categoryTitle: string;
    isFreeShipping: boolean;
    rating?: { average: number; count: number };
    vendor?: { id: number; identifier: string; name: string };
};

export async function bslSearchProducts(q: string, filters: BslSearchFilters = {}) {
    return POST<BslSearchResultItem[] | { products?: BslSearchResultItem[] }>(
        bslApiRoutes.search_products,
        { q, filters },
        { Accept: "application/json" },
    );
}
