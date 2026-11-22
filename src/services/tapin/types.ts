export type TapinPayType = 0 | 1 | 2 | 3;
export type TapinOrderType = 0 | 1 | 3 | 5;
export type TapinRegisterType = 0 | 1 | 2;
export type TapinContentType = 1 | 2 | 3 | 4;

export interface TapinProductInput {
  count: number;
  discount: number;
  price: number;
  title: string;
  weight: number;
  product_id?: number | null;
}

export interface TapinShipmentInput {
  shop_id?: string;
  address: string;
  city_code: number;
  province_code: number;
  description?: string | null;
  email?: string | null;
  employee_code?: number;
  first_name: string;
  last_name: string;
  mobile: string;
  phone?: string | null;
  postal_code: string;
  pay_type: TapinPayType;
  order_type: TapinOrderType;
  box_id: number;
  packet_type: number;
  pre_paid_price?: number;
  packaging_price?: number;
  package_weight: number;
  has_insurance?: boolean;
  content_type?: TapinContentType;
  kiosk_id?: number;
  duration?: number;
  parcel_turning?: boolean;
  products: TapinProductInput[];
}

export interface TapinRegisterInput extends TapinShipmentInput {
  register_type: TapinRegisterType;
  manual_id: string;
  presenter_code?: number;
}

export interface TapinEnvelope<T> {
  returns?: { status?: number; message?: string };
  entries: T;
}

export interface TapinRegisteredOrder {
  id: string;
  order_id: number;
  barcode: string;
  status: number;
  total_price?: number;
  send_price?: number;
  created_at?: string;
}

export interface TapinPrice {
  send_price: number;
  total_send_price: number;
  total_service_price: number;
  total_price: number;
  total_send_price_discount: number;
  total_weight: number;
  [key: string]: number;
}
