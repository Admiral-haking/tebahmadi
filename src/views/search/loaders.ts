import { ProductStatus } from "@/catalog/models/Product"

export type ProductSearchItem = {
    id: string;
    title: string;
    slug: string;
    status: ProductStatus;
    productTypeId: string;
    productTypeName: string;
    variantCount: number;
    minPrice: number | undefined;
    maxPrice: number | undefined;
    inventoryTotal: number;
    activeInStockVariantCount: number;
    createdAt: string | undefined;
    updatedAt: string | undefined;
    images: string[]
}

export async function loadProducts(q: string, page: number): Promise<{ products: ProductSearchItem[], total: number }> {
    const params = new URLSearchParams({
        q,
        limit: '20',
        skip: String((page - 1) * 20),
        status: 'active',
    });
    const res = await fetch(`/api/catalog/products?${params}`, { method: "GET" });

    if (!res.ok) throw new Error(`Search failed: ${res.status}`);

    return res.json();
}
