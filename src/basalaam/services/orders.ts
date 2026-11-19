import { Get } from "@/utils/fetch";
import { bslApiRoutes } from "../constants/route";
import { bslBearerHeader } from "./auth";


export async function bslOrders(vendorId: string, cursor?: string) {
    const { headers } = await bslBearerHeader(vendorId);

    const res = await Get<BslVendorOrdersResponse>(
        bslApiRoutes.orders.concat(`?per_page=30${cursor ? `&cursor=${cursor}` : ""}`),
        headers
    );
    return res;
}

interface ResizedImage {
    property1: string;
    property2: string;
}

interface Image {
    id: number;
    original: string;
    format: string;
    resized: ResizedImage;
}

interface City {
    id: number;
    title: string;
    parent: object; // Can be more specific if needed
}

interface VendorOwner {
    id: number;
    hash_id: string;
    name: string;
    avatar: Image;
}

interface Vendor {
    id: number;
    identifier: string;
    title: string;
    city: City;
    owner: VendorOwner;
    logo: Image;
}

interface Recipient {
    name: string;
    mobile: string;
    postal_code: string;
    postal_address: string;
    latitude: number;
    longitude: number;
    house_number: string;
    house_unit: string;
}

interface User {
    id: number;
    hash_id: string;
    name: string;
    avatar: Image;
}

interface Customer {
    recipient: Recipient;
    city: City;
    user: User;
}

interface Order {
    id: number;
    paid_at: string;
    created_at: string;
    customer: Customer;
}

interface Status {
    id: number;
    title: string;
}

interface ShippingMethodItem {
    id: number;
    title: string;
}

interface ShippingMethod {
    current: ShippingMethodItem;
    default: ShippingMethodItem;
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
}

interface VariationProperty {
    property: Property;
    value: PropertyValue;
}

interface Variation {
    id: number;
    properties: VariationProperty[];
}

interface Product {
    id: number;
    name: string;
    category_id: number;
    photos: Image[];
}

interface Item {
    id: number;
    title: string;
    quantity: number;
    weight: number;
    net_weight: number;
    price: number;
    product: Product;
    variation: Variation | null;
}

interface PostReceipt {
    id: number;
    tracking_code: string;
    final_post_cost: number;
    created_at: string;
    updated_at: string;
    tracking_link: string;
    phone_number: string;
    attachment: Image;
    editable: boolean;
    edited: boolean;
}

export interface BslOrder {
    id: number;
    total_items_price: number;
    created_at: string;
    updated_at: string;
    weight: number;
    is_freight_collect: boolean;
    estimate_send_at: string;
    vendor: Vendor;
    order: Order;
    status: Status;
    shipping_method: ShippingMethod;
    items: Item[];
    post_receipt: PostReceipt;
}

export interface BslVendorOrdersResponse {
    data: BslOrder[];
    next_cursor: string;
    previous_cursor: string;
}