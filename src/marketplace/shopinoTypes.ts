export interface ShopinoSpec {
  name: string;
  value: string;
}

export interface ShopinoAttribute {
  key: string;
  name: string;
  value: string;
}

export interface ShopinoVariation {
  id: number | string;
  price: number;
  discounted_price: number;
  stock_quantity: number;
  images: string[];
  attributes: ShopinoAttribute[];
}

export interface ShopinoProduct {
  id: number | string;
  title: string;
  categories: string[];
  specs: ShopinoSpec[];
  description: string;
  images: string[];
  url: string;
  size_guide?: string;
  variations: ShopinoVariation[];
}

export interface ShopinoSubmitOrderPayload {
  order_id: number;
  first_name: string;
  last_name: string;
  province: string;
  city: string;
  address: string;
  postcode: string;
  phone: string;
  shipping_title: string;
  shipping_price: number;
  note?: string;
  items: {
    product_id: number | string;
    variation_id: number | string;
    quantity: number;
    price: number;
    discounted_price: number;
  }[];
}

export interface ShopinoSubmitOrderResponse {
  id: number;
}

export interface ShopinoTrackingPayload {
  order_ids: number[];
}

export interface ShopinoTrackingResponse {
  codes: (string | null)[];
}

export interface ShopinoProductsListResponse {
  products: ShopinoProduct[];
  page: number;
  total_pages: number;
  total: number;
}

export interface ShopinoProductResponse {
  product: ShopinoProduct;
}
