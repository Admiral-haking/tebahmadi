import { ProductSchema } from "@/catalog/models/Product";

export interface SnappVendorsResponse {
    status: boolean;
    data: {
        id: string;
        title: string;
        title_en: string;
        status: "ACTIVE" | string;
    }[];
}
export interface SnappVendorDetailResponse {
    status: boolean;
    data: {
        id: string;
        title: string;
        title_en: string;
        status: "ACTIVE" | string;
    };
}

export interface SnappProductsResponse {
    status: boolean;
    data: {
        id: string;
        sku: string;
        active: boolean;
        capacity: null | string | number;
        stock: number;
        warehouse_stock: number;
        title: string;
        title_en: string;
        thumbnail: null | string;
        price: number;
        warranty: null | string;
        discount: null | {
            id: string;
            special_price: number;
            stock: number;
            vendor_share: number;
            percent: number;
            start_at: string;
            end_at: string;
            created_at: string;
            updated_at: string;
        };
        variation_attributes: {
            attribute: { id: string; title: string; unit: null | string };
            value: { id: string; title: string; icon: string };
        }[];
        created_at: string;
        match?: ProductSchema | null
    }[];
    meta: {
        pagination: {
            total: number;
            count: number;
            per_page: number;
            current_page: number;
            total_pages: number;
            links: { next: string | null; previous: string | null };
        };
    };
}

export interface SnappSingleProductResponse {
    status: boolean;
    data: {
        id: string;
        sku: string;
        active: boolean;
        capacity: null | string | number;
        stock: number;
        warehouse_stock: number;
        title: string;
        title_en: string;
        thumbnail: null | string;
        price: number;
        warranty: null | string;
        discount: null | {
            id: string;
            special_price: number;
            stock: number;
            vendor_share: number;
            percent: number;
            start_at: string;
            end_at: string;
            created_at: string;
            updated_at: string;
        };
        variation_attributes: {
            attribute: { id: string; title: string; unit: null | string };
            value: { id: string; title: string; icon: string };
        }[];
        created_at: string;
    };
}

export interface SnappUpdateProductsBody {
    products: {
        sku: string;                        // required
        stock?: number;
        price?: number;
        capacity?: number;
        special_price?: number;
        special_price_start_at?: string;
        special_price_end_at?: string;
        special_price_stock?: number;
    }[];
}

export interface SnappUpdateProductsResponse {
    status: boolean;
    data: {
        d: string;      // first item uses "d" instead of "id"
        sku: string;
        status: boolean;
        messages: string[];
    }[];
}

export interface SnappOrder {
    order_number: number;
    created_at: string;
    delivery_type: string;
    order_status: "CONFIRMED" | "CANCELED";
    item_origin: string;
    point_of_sales_at: string | null;
    pickup_time: { start: string; end: string };
    customer: {
        first_name: string;
        last_name: string;
        phone: string | null;
        national_id: string | null;
        address: {
            phone: string;
            address: string;
            neighborhood: string | null;
            house_unit: string | null;
            house_number: string | null;
            latitude: string;
            longitude: string;
            city: string;
            city_id: string;
            province_id: string;
            province: string;
            postal_code: string | null;
        };
    };
    items: {
        sku: string | null;
        vendor_product_info_id: string;
        item_status: string;
        quantity: number;
        canceled_quantity: number;
        original_price: number;
        discount_amount: number;
        final_price: number;
    }[];
}
export interface SnappOrdersResponse {
    status: boolean;
    data: SnappOrder[];
    meta: {
        pagination: {
            path: string;
            per_page: number;
            count: number;
            links: { next: string };
            has_more: boolean;
            next_cursor: string;
        };
    };
}
export interface SnappOrderDetailResponse {
    status: boolean;
    data: SnappOrder;
}