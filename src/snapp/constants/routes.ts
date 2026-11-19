const BASE = 'https://apix.snappshop.ir/automation/v1';


export const snappApiRoutes = {
    vendors: `${BASE}/vendors`,
    vendor_details: (vendor_id: string) => `${BASE}/vendors/${vendor_id}`,
    products: (vendor_id: string) => `${BASE}/vendors/${vendor_id}/products`,
    product_detail: (vendor_id: string, id: string) => `${BASE}/vendors/${vendor_id}/products/${id}`,
    orders: (vendor_id: string) => `${BASE}/vendors/${vendor_id}/orders`,
    order_details: (vendor_id: string, order_id: string) => `${BASE}/vendors/${vendor_id}/orders/${order_id}`,
}