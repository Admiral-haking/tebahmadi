import { dgkApiRoutes } from "../constants/routes";
import { dgkAuthedGet } from "../utils/authed-fetch";

export async function dgkGetProducts(vendorId: string, page: number, searchTerm = "") {
    const url = new URL(dgkApiRoutes.products);
    url.searchParams.set("page", String(page));
    const cleanSearchTerm = searchTerm.trim();
    if (cleanSearchTerm) {
        url.searchParams.set("search[search_term]", cleanSearchTerm);
    }

    const res = await dgkAuthedGet<DgkProductsResponse>(vendorId, url.toString());

    return res;
}

export async function dgkGetProductVariantsPage(
    vendorId: string,
    product_id: string,
    page = 1,
    size = 50,
    onlyActive = false,
) {
    const res = await dgkAuthedGet<DgkVariantsResponse>(
        vendorId,
        dgkApiRoutes.product_variants(product_id, page, size, onlyActive),
    );

    return res;
}

export async function dgkGetProductVariants(vendorId: string, product_id: string) {
    const res = await dgkAuthedGet<DgkVariantsResponse>(
        vendorId,
        dgkApiRoutes.product_variants(product_id),
    );

    const pager = res?.data?.pager;
    const totalPages = Number(pager?.total_pages ?? 1);

    if (!Number.isFinite(totalPages) || totalPages <= 1) {
        return res;
    }

    // Fetch remaining pages sequentially (with a small delay) instead of firing
    // them all at once — the parallel burst tripped Digikala's rate limit and
    // made the whole compare fail. Cap pages to keep the request bounded.
    const MAX_PAGES = 20;
    const lastPage = Math.min(totalPages, MAX_PAGES);
    const pageResponses: DgkVariantsResponse[] = [];
    for (let page = 2; page <= lastPage; page += 1) {
        pageResponses.push(
            await dgkAuthedGet<DgkVariantsResponse>(vendorId, dgkApiRoutes.product_variants(product_id, page)),
        );
        if (page < lastPage) await new Promise((resolve) => setTimeout(resolve, 200));
    }

    const seen = new Set<number>();
    res.data.items = [res, ...pageResponses]
        .flatMap((pageResponse) => Array.isArray(pageResponse?.data?.items) ? pageResponse.data.items : [])
        .filter((item) => {
            const key = Number(item.product_variant_id ?? item.id);
            if (!Number.isFinite(key) || seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    res.data.pager.page = 1;
    res.data.pager.total_pages = totalPages;
    res.data.pager.total_rows = Math.max(Number(pager?.total_rows ?? 0), res.data.items.length);

    return res;

}

export interface DgkProductsResponse {
    status: string;
    data: Data;
}

interface Data {
    sort_data: SortData;
    pager: Pager;
    form_data: FormData;
    items: Item[];
    meta_data: MetaData;
    rate_limit: RateLimit;
}

interface SortData {
    sort_column: string;
    sort_order: string;
    sort_columns: string[];
}

interface Pager {
    page: number;
    item_per_page: number;
    total_pages: number;
    total_rows: number;
}

interface FormData {
    moderation_status: string;
}

export interface ProductImportEligibility {
    canImport: boolean;
    totalVariants: number;
    activeVariantCount: number;
    activeInStockVariantCount: number;
    inactiveVariantCount?: number;
    zeroStockVariantCount?: number;
    inStockVariantCount?: number;
    updatedAt: string;
    reason?: string;
}

interface Item {
    variants_count: number;
    site: string;
    title: string;
    status: string;
    product_id: number;
    fake: boolean;
    status_data: string;
    is_owner: boolean;
    main_category_title: Record<string, string>;
    active: boolean;
    title_fa: string;
    title_en: string;
    brand_id: number;
    brand_title_en: string;
    brand_title_fa: string;
    product_url: string;
    image_src: string;
    dimension_level: string;
    brand_title: string;
    moderation_status: ModerationStatus;
    adverge_url: string | null;
    product_dimension: ProductDimension;
    tags: any[];
    demand_count: number;
    isMatch?: boolean
    matchedProduct?: {
        id: string;
        title: string;
        slug: string;
    } | null
    importEligibility?: ProductImportEligibility | null
}

interface ModerationStatus {
    title: string;
    status: string;
    duplicate: string | null;
    link: string | null;
}

interface ProductDimension {
    width: number;
    length: number;
    height: number;
    weight: number;
}

interface MetaData {
    filters: FilterGroup[];
    filtered: Filtered;
}

type FilterGroup = Filter[];

interface Filter {
    name: string;
    type: string;
    label: string;
    description?: string;
    dynamic?: boolean;
    db_name?: string;
    data?: Record<string, string>;
    enum?: string[];
}

interface Filtered {
    moderation_status: Record<string, Filter[]>;
}

interface RateLimit {
    max: number;
    current: number;
    resetTime: ResetTime;
}

interface ResetTime {
    date: string;
    timezone_type: number;
    timezone: string;
}

export interface DgkVariantsResponse {
    status: string;
    data: VariantsData;
}

interface VariantsData {
    sort_data: VariantsSortData;
    pager: Pager;
    form_data: VariantsFormData;
    items: VariantItem[];
    meta_data: VariantsMetaData;
    rate_limit: RateLimit;
}

interface VariantsSortData {
    sort_column: string;
    sort_order: string;
    sort_columns: string[];
}

interface Pager {
    page: number;
    item_per_page: number;
    total_pages: number;
    total_rows: number;
}

interface VariantsFormData {
    active: string;
    moderation_status: string;
    search_term: string;
}

interface VariantItem {
    id: number;
    image_src: string;
    seller_id: number;
    main_category_title: string;
    category_id: number;
    product_id: number;
    product_url: string;
    product_variant_id: number;
    supplier_code: string;
    product_moderation_status: string;
    title: string;
    product_title: string;
    active: boolean;
    lead_time: number;
    price_list: number;
    market_price_last_update: string;
    price_type: string;
    selling_channel_site: string;
    price_sale: number;
    cash_selling_price: number;
    credit_selling_price: number;
    credit_increase_percentage: number;
    maximum_credit_increase_percentage: number;
    marketplace_seller_stock: number;
    warehouse_stock: number;
    on_the_way_stock: number;
    reservation: number;
    left_consumer: number;
    maximum_per_order: number;
    allowed_count: number;
    ovl_selling_active: boolean;
    created_at: Timestamp;
    pol_active: boolean;
    supply_category: SupplyCategory;
    product_order_limit_minimum: number | null;
    category_price_configs: CategoryPriceConfigs;
    seller_product_tags: any[];
    max_lead_time: number;
    buy_box_price: number;
    buy_box_badge_label: string;
    is_buy_box_winner: boolean;
    is_sku_winner: boolean;
    sku_config: SkuConfig;
    is_seller_buy_box_winner: boolean;
    is_in_buy_box_challenge: boolean;
    min_selling_price_limit: number | null;
    suppressed_until: string | null;
    suppression_reason: string | null;
    product_selling_chanel: SellingChannel;
    variant_selling_chanel: SellingChannel;
    is_in_incredible_promotion: boolean;
    is_in_periodic_promotion: boolean;
    is_in_promotion: boolean;
    promotion_price: number;
    shipping_nature_id: number;
    default_selling_chanel_code: number;
    rating: number | null;
    is_promotion_management_visible_for_seller: boolean;
    is_archived: boolean;
    fulfilment_and_delivery_cost: number;
    seller_reservation: number;
    digikala_reservation: number;
    seller_shipping_lead_time: number;
    shipping_options: ShippingOptions;
    gold_price_parameters: any | null;
    auto_pricing: AutoPricing;
}

interface Timestamp {
    date: string;
    timezone_type: number;
    timezone: string;
}

interface SupplyCategory {
    id: number;
    title: string;
}

interface CategoryPriceConfigs {
    order_limit_minimum: number;
    order_limit_maximum: number;
}

interface SkuConfig {
    color: string;
    size: string;
}

interface SellingChannel {
    active_digikala: boolean;
    active_digistyle: boolean;
}

interface ShippingOptions {
    is_fbs_ability_enable: boolean;
    is_fbd_active: boolean;
    is_fbs_active: boolean;
    is_needed_fbs_setting: boolean;
    is_sbs_module_active: boolean;
    only_sbs: boolean;
    is_three_hour_delivery_active: boolean;
    is_three_hour_checkbox_active: boolean;
}

interface AutoPricing {
    category: string | null;
    status: string;
}

interface VariantsMetaData {
    leaf_categories: Record<string, string>;
    reference_price: ReferencePrice;
}

interface ReferencePrice {
    printed: number;
    recommended: number;
    regulated: number;
}

interface RateLimit {
    max: number;
    current: number;
    resetTime: Timestamp;
}
