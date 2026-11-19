
export const bslApiRoutes = {
    auth: 'https://auth.basalam.com/oauth/token',
    whoami: 'https://auth.basalam.com/whoami',
    me: 'https://openapi.basalam.com/v1/users/me',
    upload: 'https://openapi.basalam.com/v1/files',
    new_product: (vendor_id: number) => `https://openapi.basalam.com/v1/vendors/${vendor_id}/products`,
    products: (vendor_id: number) => `https://openapi.basalam.com/v1/vendors/${vendor_id}/products`,
    orders: 'https://openapi.basalam.com/v1/vendor-parcels',
    order_detail: (parcel_id: number) => `https://openapi.basalam.com/v1/vendor-parcels/${parcel_id}`,
    order_accept: (parcel_id: number) => `https://openapi.basalam.com/v1/vendor-parcels/${parcel_id}/set-preparation`,
    order_send: (parcel_id: number) => `https://openapi.basalam.com/v1/vendor-parcels/${parcel_id}/set-posted`,
    patch_product: (product_id: number, variation_id?: number | null) => `https://openapi.basalam.com/v1/products/${product_id}${variation_id ? `/variations/${variation_id}` : ""}`,
    // Core read endpoints (SDK docs sec 5) on the same proven v1 gateway.
    product: (product_id: number) => `https://openapi.basalam.com/v1/products/${product_id}`,
    vendor: (vendor_id: number) => `https://openapi.basalam.com/v1/vendors/${vendor_id}`,
    categories: `https://openapi.basalam.com/v1/categories`,
    category: (category_id: number) => `https://openapi.basalam.com/v1/categories/${category_id}`,
    category_attributes: (category_id: number) => `https://openapi.basalam.com/v1/categories/${category_id}/attributes`,
    working_shipping_methods: (vendor_id: number) => `https://openapi.basalam.com/v1/vendors/${vendor_id}/shipping-methods`,
    // Product discounts (SDK sec 5): create_discount / delete_discount.
    create_discount: (vendor_id: number) => `https://openapi.basalam.com/v1/vendors/${vendor_id}/products/discounts`,
    delete_discount: (vendor_id: number) => `https://openapi.basalam.com/v1/vendors/${vendor_id}/products/discounts`,
    // Order stats (SDK sec 7).
    orders_stats: `https://openapi.basalam.com/v1/vendor-parcels/stats`,
    // Product search (SDK sec 8) — search service host.
    search_products: `https://search.basalam.com/ai-engine/api/v2.0/product/search`,
    // Webhook service (SDK sec 12) — webhook service host.
    webhook_services: `https://webhook.basalam.com/v1/services`,
    webhooks: `https://webhook.basalam.com/v1/webhooks`,
    webhook: (webhook_id: number) => `https://webhook.basalam.com/v1/webhooks/${webhook_id}`,
    webhook_events: `https://webhook.basalam.com/v1/events`,
    webhook_register: `https://webhook.basalam.com/v1/customers/register`,
    webhook_unregister: `https://webhook.basalam.com/v1/customers/unregister`,
}


export enum BSL_TRANSPORTS {
    SPECIAL = 3197,
    EXPRESS = 3198,
    COURIER = 3259,
    TRANSIT = 5137,
    TIPAX = 4040,
    MAHEX = 6102,
    CHAPAR = 6101,
    AMADAST = 6110,
    DECA = 6111,
    CHEETA = 6112,
    BOXIT = 6113,
    SALAM_RESAN = 6114,
    DIGIEXPRESS = 7058,
    TOPIN = 7059,
    PARSI = 7060,
    PINEX = 7061
}

export const BSL_TRANSPORT_LABELS: Record<BSL_TRANSPORTS, string> = {
    [BSL_TRANSPORTS.SPECIAL]: "ویژه",
    [BSL_TRANSPORTS.EXPRESS]: "اکسپرس",
    [BSL_TRANSPORTS.COURIER]: "پیک",
    [BSL_TRANSPORTS.TRANSIT]: "ترانزیت",
    [BSL_TRANSPORTS.TIPAX]: "تیپاکس",
    [BSL_TRANSPORTS.MAHEX]: "ماهکس",
    [BSL_TRANSPORTS.CHAPAR]: "چاپار",
    [BSL_TRANSPORTS.AMADAST]: "آماداست",
    [BSL_TRANSPORTS.DECA]: "دکا",
    [BSL_TRANSPORTS.CHEETA]: "چیتا",
    [BSL_TRANSPORTS.BOXIT]: "باکسیت",
    [BSL_TRANSPORTS.SALAM_RESAN]: "سلام رسان",
    [BSL_TRANSPORTS.DIGIEXPRESS]: "دیجی اکسپرس",
    [BSL_TRANSPORTS.TOPIN]: "توپین",
    [BSL_TRANSPORTS.PARSI]: "پارسی",
    [BSL_TRANSPORTS.PINEX]: "پینکس"
};
