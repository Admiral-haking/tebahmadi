import { Get } from "@/utils/fetch";
import { bslApiRoutes } from "../constants/route";
import { bslBearerHeader } from "./auth";

/**
 * Basalam Core read services (SDK docs section 5) on the v1 gateway.
 * These back product creation/editing (categories + attributes) and vendor info.
 */

export type BslCategory = {
    id: number;
    title: string;
    parent_id?: number | null;
    parent?: { id: number; title: string } | null;
};

export type BslCategoryAttribute = {
    id: number;
    title: string;
    required?: boolean;
    type?: { name: string; value: number };
    values?: { id: number; title: string; value?: string }[];
};

/** get_categories() — all categories. */
export async function bslGetCategories(vendorId: string) {
    const { headers } = await bslBearerHeader(vendorId);
    return Get<{ data?: BslCategory[] } | BslCategory[]>(bslApiRoutes.categories, headers);
}

/** get_category(category_id) — a single category. */
export async function bslGetCategory(vendorId: string, categoryId: number) {
    const { headers } = await bslBearerHeader(vendorId);
    return Get<BslCategory>(bslApiRoutes.category(categoryId), headers);
}

/** get_category_attributes(category_id, ...) — attributes for a category. */
export async function bslGetCategoryAttributes(
    vendorId: string,
    categoryId: number,
    opts?: { product_id?: number; vendor_id?: number; exclude_multi_selects?: boolean },
) {
    const { headers, vendor_id } = await bslBearerHeader(vendorId);
    const qs = new URLSearchParams();
    if (opts?.product_id) qs.set("product_id", String(opts.product_id));
    qs.set("vendor_id", String(opts?.vendor_id ?? vendor_id));
    if (opts?.exclude_multi_selects) qs.set("exclude_multi_selects", "true");
    const url = bslApiRoutes.category_attributes(categoryId).concat("?", qs.toString());
    return Get<{ data?: BslCategoryAttribute[] } | BslCategoryAttribute[]>(url, headers);
}

/** get_vendor(vendor_id) — vendor details. Defaults to the authenticated vendor. */
export async function bslGetVendor(vendorId: string, targetVendorId?: number) {
    const { headers, vendor_id } = await bslBearerHeader(vendorId);
    return Get<Record<string, unknown>>(bslApiRoutes.vendor(targetVendorId ?? vendor_id), headers);
}

/** get_product(product_id) — single product detail. */
export async function bslGetProduct(vendorId: string, productId: number) {
    const { headers } = await bslBearerHeader(vendorId);
    return Get<Record<string, unknown>>(bslApiRoutes.product(productId), headers);
}

/** get_working_shipping_methods(vendor_id) — active shipping methods for a vendor. */
export async function bslGetWorkingShippingMethods(vendorId: string, targetVendorId?: number) {
    const { headers, vendor_id } = await bslBearerHeader(vendorId);
    return Get<Record<string, unknown>>(bslApiRoutes.working_shipping_methods(targetVendorId ?? vendor_id), headers);
}
