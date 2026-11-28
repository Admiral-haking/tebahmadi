export type StateOption = {
  code: number;
  title: string;
  cities: Array<{ code: number; title: string }>;
};

export type BoxOption = {
  pk: number;
  title: string;
  length?: number;
  width?: number;
  height?: number;
};

export type ShopOption = { id: string; title: string };
export type KioskOption = { pk: number; company: string; address: string };

export type TapinOptions = {
  states: StateOption[];
  boxes: BoxOption[];
  shops: ShopOption[];
  warnings?: string[];
};

export type TapinOptionsResponse = {
  data?: TapinOptions;
  error?: unknown;
};

export type TapinKiosksResponse = {
  data?: { list?: KioskOption[] };
  error?: unknown;
};

export type TapinQuoteResponse = {
  data?: Record<string, number>;
  error?: unknown;
};

export type TapinShipmentView = {
  id: string;
  orderId: number;
  barcode?: string;
  status: number;
  totalPrice?: number;
  sendPrice?: number;
  registeredAt: string;
  syncedAt?: string;
  provinceCode?: number;
  cityCode?: number;
  boxId?: number;
  packetType?: number;
  packageWeight?: number;
  orderType?: number;
  contentType?: number;
  hasInsurance?: boolean;
  shopId?: string;
  payType?: number;
  employeeCode?: number;
  prePaidPrice?: number;
  packagingPrice?: number;
  presenterCode?: number;
  kioskId?: number;
  duration?: number;
  parcelTurning?: boolean;
  itemWeights?: Array<{ variantId: string; weightGrams: number }>;
};

export type ManualTapinFormInput = {
  invoiceId: string;
  shopId: string;
  provinceCode: number;
  cityCode: number;
  boxId: number;
  packetType: 1 | 2 | 3 | '';
  packageWeight: number | '';
  orderType: 0 | 1 | 3 | 5 | '';
  registerType: 0 | 1 | 2 | '';
  contentType: 1 | 2 | 3 | 4 | '';
  hasInsurance: boolean | null;
  payType?: 0 | 1 | 2 | 3 | '';
  employeeCode?: number | '';
  prePaidPrice?: number | '';
  packagingPrice?: number | '';
  presenterCode?: number | '';
  kioskId?: number | '';
  duration?: number | '';
  parcelTurning?: boolean;
  itemWeights?: Array<{ variantId: string; weightGrams: number }>;
};

export type ManualTapinPayload = {
  invoiceId: string;
  shopId: string;
  provinceCode: number;
  cityCode: number;
  boxId: number;
  packetType: 1 | 2 | 3;
  packageWeight: number;
  orderType: 0 | 1 | 3 | 5;
  registerType: 0 | 1 | 2;
  contentType: 1 | 2 | 3 | 4;
  hasInsurance: boolean;
  payType?: 0 | 1 | 2 | 3;
  employeeCode?: number;
  prePaidPrice?: number;
  packagingPrice?: number;
  presenterCode?: number;
  kioskId?: number;
  duration?: number;
  parcelTurning?: boolean;
  itemWeights?: Array<{ variantId: string; weightGrams: number }>;
};
