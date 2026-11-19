import { dgkApiRoutes } from "../constants/routes";
import { dgkAuthedGet } from "../utils/authed-fetch";
import ProductModel, { AttributeValue } from "@/catalog/models/Product";
import ProductTypeModel, { ProductTypeDocument } from "@/catalog/models/ProductType";

export async function getDgkInventory(vendorId: string, page: number) {
    const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;

    const response = await dgkAuthedGet<{ data?: DgkInventoryResponse } | DgkInventoryResponse>(
        vendorId,
        dgkApiRoutes.inventory.concat("?page=", safePage.toString()),
    );

    const res = normalizeDgkInventoryResponse(response);
    if (!Array.isArray(res.items)) res.items = [];

    const barcodes = Array.from(
        new Set(
            res.items
                .map(x => typeof x.supplier_code === "string" ? x.supplier_code.trim() : "")
                .filter(Boolean)
        )
    );

    if (barcodes.length) {
        const productTypes = await ProductTypeModel.find().lean<ProductTypeDocument[]>();
        const products = await ProductModel.find({ 'variants.barcode': { $in: barcodes } })
        for (let index = 0; index < res.items.length; index++) {
            const dg_product = res.items[index];
            const product = products.find(x => x.variants.some(y => y.barcode === dg_product.supplier_code));
            const variant = product?.variants.find(x => x.barcode === dg_product.supplier_code);
            if (!product || !variant) continue;
            const type = productTypes.find(x => `${x._id}` === `${product.productTypeId}`);
            const attrTitle = variant.attributeValues.map(item => {
                if (item.key === 'weightGrams') return '';
                const attribute = type?.attributes.find(x => x.key === item.key);
                return `${attribute?.label || item.key}: ${item.key === 'color' ? (item.value as any).name : item.value
                    }`;
            }).filter(x => !!x)
            res.items[index].match = {
                attributeValues: variant.attributeValues,
                barcode: variant.barcode || dg_product.supplier_code,
                mediaId: variant.mediaIds?.[0] && `${variant.mediaIds?.[0]}`,
                price: variant.price.amount,
                productId: `${product._id}`,
                quantity: variant.inventory.quantity,
                sku: variant.sku,
                trackingUnit: variant.inventory.trackingUnit,
                variantId: `${variant._id}`,
                displayName: `${product.title} ${attrTitle.join(" | ")}`,
                slug: product.slug
            }
        }
    }

    return res;
}

function isInventoryResponse(value: unknown): value is DgkInventoryResponse {
    return Boolean(value && typeof value === "object" && Array.isArray((value as DgkInventoryResponse).items));
}

export function normalizeDgkInventoryResponse(response: { data?: DgkInventoryResponse } | DgkInventoryResponse): DgkInventoryResponse {
    if (isInventoryResponse(response)) return response;
    if (isInventoryResponse(response?.data)) return response.data;

    return {
        sort_data: {
            sort_column: "",
            sort_order: "desc",
            sort_columns: [],
        },
        pager: {
            page: 1,
            item_per_page: 50,
            total_pages: 1,
            total_rows: 0,
        },
        items: [],
        meta_data: {
            categories: {},
            items_has_rts: false,
            warehouses: {},
        },
        rate_limit: {
            max: 0,
            current: 0,
            resetTime: {
                date: "",
                timezone_type: 3,
                timezone: "Asia/Tehran",
            },
        },
    };
}

export interface DgkInventoryResponse {
    sort_data: {
        sort_column: string;
        sort_order: 'asc' | 'desc';
        sort_columns: string[];
    };
    pager: {
        page: number;
        item_per_page: number;
        total_pages: number;
        total_rows: number;
    };
    items: {
        category_title: string;
        supplier_code: string;
        product_id: number;
        product_variant_id: number;
        title: string;
        marketplace_seller_stock: number;
        warehouse_stock: number;
        available: number;
        reserve: number;
        warehouse: number[];
        img_src: string;
        shipping_nature: string;
        shipping_nature_id: number;
        product_url: string;
        supply_stock: number;
        has_rts_package: boolean;
        has_dead_stock: boolean;
        hasRtsStock: boolean;
        has_checkbox_for_rts: boolean;
        match?: {
            productId: string
            variantId: string
            sku: string
            mediaId?: string
            price: number
            quantity: number
            trackingUnit: string
            attributeValues: AttributeValue[]
            barcode: string
            displayName: string
            slug: string
        }
    }[];
    meta_data: {
        categories: Record<string, string>;
        items_has_rts: boolean;
        warehouses: Record<string, string>;
    };
    rate_limit: {
        "max": number,
        "current": number,
        "resetTime": {
            "date": string,
            "timezone_type": number,
            "timezone": "Asia/Tehran"
        }
    }
};
