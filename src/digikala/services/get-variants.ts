import { dgkApiRoutes } from "../constants/routes";
import { dgkAuthedGet } from "../utils/authed-fetch";

export async function dgkGetVariants(vendorId: string, page: number) {

    const { data: res } = await dgkAuthedGet<Response>(vendorId, dgkApiRoutes.variants.concat("?page=", page.toString()));

    return res;

}

export interface Response {
    status: string;
    data: Data;
}

interface Data {
    sort_data: SortData;
    pager: Pager;
    form_data: [null];
    items: Item[];
    meta_data: Record<string, unknown>;

    rate_limit: {
        "max": number,
        "current": number,
        "resetTime": {
            "date": string,
            "timezone_type": number,
            "timezone": "Asia/Tehran"
        }
    }
}

interface SortData {
    sort_column: string;
    sort_order: "asc" | "desc";
    sort_columns: string[];
}

interface Pager {
    page: number;
    item_per_page: number;
    total_pages: number;
    total_rows: number;
}

interface Item {
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
    created_at: string;
    pol_active: boolean;
    b2b_params: B2bParams;
    max_lead_time: number;
    buy_box_price: number;
    buy_box_badge_label: string;
    is_buy_box_winner: boolean;
    is_sku_winner: boolean;
    sku_config: SkuConfig;
    is_seller_buy_box_winner: boolean;
    is_in_buy_box_challenge: boolean;
    suppressed_until: string;
    suppression_reason: string;
    product_selling_chanel: SellingChannel;
    variant_selling_chanel: SellingChannel;
    is_in_incredible_promotion: boolean;
    is_in_periodic_promotion: boolean;
    is_in_promotion: boolean;
    promotion_price: number;
    shipping_nature_id: number;
    default_selling_chanel_code: number;
    rating: number;
    is_promotion_management_visible_for_seller: boolean;
    is_archived: boolean;
    fulfilment_and_delivery_cost: number;
    seller_reservation: number;
    digikala_reservation: number;
    seller_shipping_lead_time: number;
    theme_values: ThemeValue[];
    shipping_options: ShippingOptions;
}

interface B2bParams {
    seller_b2b_active: boolean;
    is_only_b2b: boolean;
    is_b2b_active: boolean;
}

interface SkuConfig {
    color: string;
    size: string;
}

interface SellingChannel {
    active_digikala: boolean;
    active_digistyle: boolean;
}

interface ThemeValue {
    themeId: number;
    themeLabel: string;
    active: boolean;
    themeType: string;
    themeValue: ThemeValueDetail;
}

interface ThemeValueDetail {
    id: number;
    titleFa: string;
    titleEn: string;
    value: ColorValue;
    nature: string;
    active: boolean;
    standardUnitID: null;
    colorPallateIDs: null;
    extraData: Record<string, unknown>;
}

interface ColorValue {
    hex: string;
    rgb: string;
    value: string;
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