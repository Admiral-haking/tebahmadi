export const DGK_BASE = "https://seller.digikala.com";

export const dgkApiRoutes = {
    health_check: `${DGK_BASE}/open-api/v1/`,
    auth_token: `${DGK_BASE}/open-api/v1/auth/token`,
    auth_refresh_token: `${DGK_BASE}/open-api/v1/auth/refresh-token`,
    inventory: `${DGK_BASE}/open-api/v1/inventories`,
    variants: `${DGK_BASE}/open-api/v1/variants`,
    variant_stock_update: (variant_id: number) => `${DGK_BASE}/open-api/v1/variants/${variant_id}/seller-stock`,
    variant_update: (variant_id: number) => `${DGK_BASE}/open-api/v1/variants/${variant_id}`,
    variant_price_update: `${DGK_BASE}/open-api/v1/variants/selling-price`,
    active_orders: `${DGK_BASE}/open-api/v1/orders`,
    history_orders: `${DGK_BASE}/open-api/v1/orders/history`,
    cancel_order: (order_item_id: number) => `${DGK_BASE}/open-api/v1/orders/${order_item_id}`,
    shipping: (order_id: number) => `${DGK_BASE}/open-api/v1/shipping-services/order/detail/${order_id}`,
    products: `${DGK_BASE}/open-api/v1/products/seller?size=50&sort=id&order=desc&search[moderation_status]=approved`,
    product_variants: (product_id: string, page = 1, size = 50, onlyActive = false) => {
        const activeFilter = onlyActive ? '&search[active]=true' : '';
        return `${DGK_BASE}/open-api/v1/variants?page=${page}&size=${size}&sort=id&order=asc${activeFilter}&search[moderation_status]=approved&search[search_term]=${encodeURIComponent(product_id)}`;
    },
}
