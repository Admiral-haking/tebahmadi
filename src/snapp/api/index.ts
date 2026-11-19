import { Get, PATCH } from "@/utils/fetch";
import { SnappOrderDetailResponse, SnappOrdersResponse, SnappProductsResponse, SnappSingleProductResponse, SnappUpdateProductsBody, SnappUpdateProductsResponse, SnappVendorDetailResponse, SnappVendorsResponse } from "./type";
import { snappApiRoutes } from "../constants/routes";
import { snpGetToken } from "../services/token";

export async function snpGetVendors(vendorId: string) {
    return Get<SnappVendorsResponse>(snappApiRoutes.vendors, await snpGetToken(vendorId));
}

export async function snpGetVendorDetails(vendorId: string, vendor_id: string) {
    return Get<SnappVendorDetailResponse>(snappApiRoutes.vendor_details(vendor_id), await snpGetToken(vendorId));
}

export async function snpGetProducts(vendorId: string, vendor_id: string, page: number = 1) {
    return Get<SnappProductsResponse>(snappApiRoutes.products(vendor_id).concat(`?page=${page}`), await snpGetToken(vendorId));
}

export async function snpGetProductDetails(vendorId: string, vendor_id: string, product_id: string) {
    return Get<SnappSingleProductResponse>(snappApiRoutes.product_detail(vendor_id, product_id), await snpGetToken(vendorId));
}

export async function snpUpdateProducts(vendorId: string, vendor_id: string, body: SnappUpdateProductsBody) {
    return PATCH<SnappUpdateProductsResponse>(snappApiRoutes.products(vendor_id), body, await snpGetToken(vendorId));
}

export async function snpGetOrders(vendorId: string, vendor_id: string, cursor: string = '') {
    // Build the cursor query correctly: only append when present, and always as
    // a proper ?cursor=<value> key (the previous `cursor ?? ...` produced a
    // malformed URL, so no orders ever came back).
    const qs = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
    return Get<SnappOrdersResponse>(snappApiRoutes.orders(vendor_id).concat(qs), await snpGetToken(vendorId));
}
export async function snpGetOrderDetail(vendorId: string, vendor_id: string, orderId: string) {
    return Get<SnappOrderDetailResponse>(snappApiRoutes.order_details(vendor_id, orderId), await snpGetToken(vendorId));
}