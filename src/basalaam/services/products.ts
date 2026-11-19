import { Get } from "@/utils/fetch";
import { bslApiRoutes } from "../constants/route";
import { bslBearerHeader } from "./auth";

export async function bslGetProducts(vendorId: string, page: number = 1, per_page: number = 50) {
    const { headers, vendor_id } = await bslBearerHeader(vendorId);

    console.log(`Getting: [${bslApiRoutes.products(vendor_id).concat("?page=", page.toString(), "&per_page=", per_page.toString())}]`);

    const res = Get<ProductListResponse>(bslApiRoutes.products(vendor_id).concat("?page=", page.toString(), "&per_page=", per_page.toString()), headers);

    return res;
}

interface Photo {
    id: number;
    original: string;
    xs: string;
    sm: string;
    md: string;
    lg: string;
}

interface Status {
    name: string;
    value: number;
    description: string;
}

interface RejectionReason {
    name: string;
    value: number;
    description: string;
}

interface Category {
    id: number;
    title: string;
    placeholder: string;
    parent: Record<string, unknown>; // or a more specific type if known
    unit_type_id: Status;
}

interface SelectedValue {
    id: number;
    title: string;
    value: string;
    attribute_id: number;
    order: number;
    vendor_id: number;
}

interface ProductAttribute {
    id: number;
    unit: string;
    type: Status;
    title: string;
    value: string;
    selected_values: SelectedValue[];
    required: boolean;
}

interface Video {
    id: number;
    url: string;
    original: string;
    thumbnail: string;
    hls: string;
    width: number;
    height: number;
    duration: number;
}

interface Property {
    id: number;
    title: string;
    type: string;
}

interface PropertyValue {
    id: number;
    title: string;
    value: string;
    order: number;
}

interface VariantProperty {
    property: Property;
    value: PropertyValue;
}

interface Variant {
    id: number;
    price: number;
    primary_price: number;
    stock: number;
    order: number;
    properties: VariantProperty[];
    sku: string;
    discount: Record<string, unknown>; // or a more specific type
}

interface Attribute {
    id: number;
    key: string;
    value: string;
}

interface IllegalPhoto {
    file_id: number;
    rejection_reasons: RejectionReason[];
}

interface RevisionMetadata {
    illegal_photos: IllegalPhoto[];
    description: string;
    is_conditional_approval: boolean;
}

interface RevisionData {
    title: string;
    brief: string;
    description: string;
    status: Status;
    category: Category;
    keywords: string[];
    photo: Photo;
    photos: Photo[];
    video: Video;
    product_attribute: ProductAttribute[];
    packaged_weight: number;
    net_weight: number;
    net_weight_decimal: number;
    preparation_day: number;
    price: number;
    primary_price: number;
    inventory: number;
    variants: Variant[];
    is_wholesale: boolean;
    attributes: Attribute[];
    unit_quantity: number;
}

interface Revision {
    rejection_reasons: RejectionReason[];
    data: RevisionData;
    rejected_at: string;
    metadata: RevisionMetadata;
}

interface ShippingData {
    illegal_for_iran: boolean;
    illegal_for_same_city: boolean;
}

interface Product {
    id: number;
    title: string;
    price: number;
    photo: Photo;
    status: Status;
    inventory: number;
    primary_price: number;
    is_product_for_revision: boolean;
    revision: Revision;
    preparation_day: number;
    published: boolean;
    shipping_data: ShippingData;
    net_weight: number;
    packaged_weight: number;
    net_weight_decimal: number;
    variant: Variant[];
    unit_quantity: number;
    unit_type: Status;
    sku: string;
    discount: Record<string, unknown>;
    is_wholesale: boolean;
}

interface ProductListResponse {
    data: Product[];
    total_count: number;
    result_count: number;
    total_page: number;
    page: number;
    per_page: number;
}