import { NextRequest, NextResponse } from 'next/server';
import { connectMongoose } from '@/lib/mongoose';
import { getDiscountProducts } from '@/catalog/services/productUtilService';
import ProductTypeModel from '@/catalog/models/ProductType';

export const runtime = 'nodejs';

async function serializeProducts(serializedProducts: any[]) {
    const productTypeIds = Array.from(
        new Set(
            serializedProducts
                .map((product) => product.productTypeId?.toString())
                .filter((value): value is string => typeof value === 'string' && value.length > 0),
        ),
    );

    const productTypes = productTypeIds.length
        ? await ProductTypeModel.find({ _id: { $in: productTypeIds } }, { name: 1 })
            .lean()
            .then((rows) => rows.map((row) => ({ id: row._id.toString(), name: row.name ?? '' })))
        : [];

    const productTypeMap = new Map(productTypes.map((item) => [item.id, item.name]));

    const products = serializedProducts.map((product) => {
        const variants: any[] = Array.isArray(product.variants) ? product.variants : [];
        let minPrice: number | undefined;
        let maxPrice: number | undefined;
        let inventoryTotal = 0;
        let discount = 0

        variants.forEach((variant) => {
            const priceAmount = Number((variant?.price as { amount?: unknown })?.amount ?? Number.NaN);
            if (!Number.isNaN(priceAmount)) {
                if (minPrice === undefined || priceAmount < minPrice) {
                    minPrice = priceAmount;
                }
                if (maxPrice === undefined || priceAmount > maxPrice) {
                    maxPrice = priceAmount;
                }
            }

            const quantity = Number((variant?.inventory as { quantity?: unknown })?.quantity ?? Number.NaN);
            if (!Number.isNaN(quantity)) {
                inventoryTotal += quantity;
            }

            if (discount < variant.discountPercent) {
                discount = Math.ceil(variant.discountPercent);
            }
        });

        const createdAtValue = product.createdAt;
        const updatedAtValue = product.updatedAt;

        const createdAt = createdAtValue instanceof Date ? createdAtValue.toISOString() : undefined;
        const updatedAt = updatedAtValue instanceof Date ? updatedAtValue.toISOString() : undefined;

        const productTypeIdValue = product.productTypeId?.toString() ?? '';

        return {
            id: product._id?.toString() ?? '',
            title: product.title ?? '',
            slug: product.slug ?? '',
            status: product.status ?? 'draft',
            productTypeId: productTypeIdValue,
            productTypeName: productTypeMap.get(productTypeIdValue) ?? '-',
            variantCount: variants.length,
            minPrice,
            maxPrice,
            inventoryTotal,
            createdAt,
            updatedAt,
            discount
        };
    });

    return products;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
    await connectMongoose();
    const params = req.nextUrl.searchParams;
    const q = params.get('q') ?? undefined;
    const pageParam = params.get('page');
    const perPageParam = params.get('perPage');
    const page = pageParam ? Number(pageParam) : 1;
    const perPage = perPageParam ? Number(perPageParam) : 12;

    const result = await getDiscountProducts({
        page,
        perPage,
        q,
    });

    const serializedProducts = result.items

    const products = await serializeProducts(serializedProducts);

    return NextResponse.json({ products, total: result.total });
}
