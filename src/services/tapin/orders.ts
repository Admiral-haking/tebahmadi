import type {
  TapinPrice,
  TapinRegisterInput,
  TapinRegisteredOrder,
  TapinShipmentInput,
} from './types';
import { tapinRequest } from './client';

export const checkTapinPrice = (input: TapinShipmentInput) =>
  tapinRequest<TapinPrice>('order/post/check-price', input);

export const registerTapinOrder = (input: TapinRegisterInput) =>
  tapinRequest<TapinRegisteredOrder>('order/post/register', input);

export const getTapinOrder = (orderId: number, shopId?: string) =>
  tapinRequest<Record<string, unknown>>(
    'order/post/detail',
    {
      order_id: orderId,
      shop_id: shopId,
    },
    { retrySafe: true },
  );

export const changeTapinOrderStatus = (orderId: number, status: number, shopId?: string) =>
  tapinRequest<TapinRegisteredOrder>('order/post/change-status', {
    order_id: orderId,
    status,
    shop_id: shopId,
  });

export const editTapinOrder = (
  orderId: number,
  input: Omit<TapinRegisterInput, 'register_type' | 'manual_id'>,
  shopId?: string,
) =>
  tapinRequest<TapinRegisteredOrder>('order/post/edit', {
    order_id: orderId,
    shop_id: shopId,
    ...input,
  });

export const changeTapinOrdersStatus = (ids: string[], status: 1 | 2 | 80, shopId?: string) =>
  tapinRequest<Record<string, never>>('order/post/change-status/bulk', {
    orders: ids.map((id) => ({ id })),
    status,
    shop_id: shopId,
  });

export const getTapinStates = (fast = false) =>
  tapinRequest<
    Array<{ code: number; title: string; cities: Array<{ code: number; title: string }> }>
  >('state/tree', {}, fast ? { timeoutMs: 8_000, retryAttempts: 1 } : { retrySafe: true });

export const getTapinPackingBoxes = (shopId?: string, fast = false) =>
  tapinRequest<{
    list: Array<{ pk: number; title: string; length: number; width: number; height: number }>;
    total_count: number;
  }>(
    'order/post/packing-box',
    { shop_id: shopId },
    fast ? { timeoutMs: 8_000, retryAttempts: 1 } : { retrySafe: true },
  );

export const getTapinKiosks = (provinceCode: number, cityCode: number, shopId?: string) =>
  tapinRequest<{
    list: Array<{
      pk: number;
      post_unit_id: number;
      company: string;
      address: string;
      lat: number;
      lon: number;
    }>;
    total_count: number;
  }>('order/post/kiosk', {
    province_code: provinceCode,
    city_code: cityCode,
    shop_id: shopId,
  });

export const getTapinOrderStatuses = (ordersId: number[]) =>
  tapinRequest<{
    list: Array<{
      id: string;
      order_id: number;
      barcode: string;
      status: number;
      last_change_status?: string;
    }>;
  }>('order/post/get-status/report', { orders_id: ordersId }, { retrySafe: true });

export const getTapinOrderStatusesBulk = (ids: string[], shopId?: string) =>
  tapinRequest<{
    list: Array<{ id: string; order_id: number; barcode: string; status: number }>;
    total_count: number;
  }>(
    'order/post/get-status/bulk',
    { orders: ids.map((id) => ({ id })), shop_id: shopId },
    { retrySafe: true },
  );

export const getTapinLabels = (orders: string[], shopId?: string) =>
  tapinRequest<Response>(
    'order/post/detail/label',
    { orders, shop_id: shopId },
    { responseType: 'raw' },
  );

export const getTapinInvoiceDocument = (orderId: number, shopId?: string) =>
  tapinRequest<Response>(
    'order/post/detail/html',
    { order_id: orderId, shop_id: shopId },
    { responseType: 'raw' },
  );

export const getTapinCredit = (shopId?: string) =>
  tapinRequest<{ credit: number }>('transaction/credit', { shop_id: shopId }, { retrySafe: true });

export const listTapinOrders = (
  page = 1,
  count = 20,
  filters: {
    orderId?: number;
    barcode?: string;
    status?: number;
    firstName?: string;
    lastName?: string;
    province?: number;
    city?: number;
    payType?: number;
    orderType?: number;
    createdAt?: string;
    shopId?: string;
  } = {},
) =>
  tapinRequest<{
    list: Array<{
      id: string;
      order_id: number;
      barcode: string;
      status: number;
      first_name: string;
      last_name: string;
      mobile: string;
      created_at: string;
    }>;
    page: number;
    count: number;
    total_count: number;
  }>(
    'order/post/list',
    {
      page,
      count,
      order_id: filters.orderId,
      barcode: filters.barcode,
      status: filters.status,
      first_name: filters.firstName,
      last_name: filters.lastName,
      province_code: filters.province,
      city_code: filters.city,
      pay_type: filters.payType,
      order_type: filters.orderType,
      created_at: filters.createdAt,
      shop_id: filters.shopId,
    },
    { retrySafe: true },
  );

export const listTapinTransactions = (page = 1, count = 10, shopId?: string) =>
  tapinRequest<{
    list: Array<{
      id: string;
      price: number;
      pay_type_description: string;
      status: number;
      status_description: string;
      create_at: string;
    }>;
    total_count: number;
  }>(
    'transaction/online-increase-credit/list',
    { page, count, shop_id: shopId },
    { retrySafe: true },
  );

export const listTapinTasks = (page = 1, count = 10) =>
  tapinRequest<{
    list: Array<{ id: string; task_type: number; task_status: number; created_at: string }>;
    total_count: number;
  }>('task/list', { page, count }, { retrySafe: true, includeShopId: false });

export const listTapinShops = (fast = false) =>
  tapinRequest<{
    list: Array<{ id: string; title: string }>;
    total_count: number;
  }>(
    'shop/list',
    { page: 1, count: 100 },
    fast
      ? { timeoutMs: 8_000, retryAttempts: 1, includeShopId: false }
      : { retrySafe: true, includeShopId: false },
  );

export const getTapinShop = (shopId?: string) =>
  tapinRequest<{
    title: string;
    status: number;
    status_display: string;
    owner_first_name: string;
    owner_last_name: string;
    owner_mobile: string;
    address: string;
  }>('shop/detail', { shop_id: shopId }, { retrySafe: true });

export const listTapinCustomers = (
  page = 1,
  count = 10,
  filters: {
    firstName?: string;
    lastName?: string;
    mobile?: string;
    phone?: string;
    email?: string;
    postalCode?: string;
    state?: number;
    city?: number;
    createdAt?: string;
    categoryId?: string;
    shopId?: string;
  } = {},
) =>
  tapinRequest<{
    list: Array<{
      customer_id: string;
      first_name: string;
      last_name: string;
      mobile: string;
      city: number;
      state: number;
      created_at: string;
    }>;
    total_count: number;
  }>(
    'customer/list',
    {
      page,
      count,
      first_name: filters.firstName,
      last_name: filters.lastName,
      mobile: filters.mobile,
      phone: filters.phone,
      email: filters.email,
      postal_code: filters.postalCode,
      state: filters.state,
      city: filters.city,
      created_at: filters.createdAt,
      category_id: filters.categoryId,
      shop_id: filters.shopId,
    },
    { retrySafe: true },
  );

export const listTapinCustomerCategories = (shopId?: string) =>
  tapinRequest<{
    list: Array<{ category_parent_id: string; category_id: string; title: string }>;
    total_count: number;
  }>('customer/category/list', { page: 1, count: 500, shop_id: shopId }, { retrySafe: true });

export const listTapinEmployees = (shopId?: string) =>
  tapinRequest<{
    list: Array<{
      first_name: string;
      last_name: string;
      username: string;
      employee_code: string;
    }>;
    total_count: number;
  }>('employee/list', { page: 1, count: 100, shop_id: shopId }, { retrySafe: true });

export const getTapinTask = (taskId: string) =>
  tapinRequest<{
    id: string;
    task_type: number;
    task_status: number;
    created_at: string;
    started_at?: string;
    ended_at?: string;
    has_downloadable_file: boolean;
    task_result: unknown[];
  }>('task/detail', { task_id: taskId }, { retrySafe: true });

export const createTapinCreditPayment = (price: number, redirectPage: string, shopId?: string) =>
  tapinRequest<{ url: string; transaction_pk: string }>('transaction/indirect/new', {
    price,
    redirect_page: redirectPage,
    shop_id: shopId,
  });

export const getTapinLabelsByDate = (fromDate: string, toDate: string, shopId?: string) =>
  tapinRequest<Response>(
    'order/post/detail/label/date',
    { from_date: fromDate, to_date: toDate, shop_id: shopId },
    { responseType: 'raw' },
  );

export const getTapinBarcodesByDate = (fromDate: string, toDate: string, shopId?: string) =>
  tapinRequest<Response>(
    'order/post/barcode/html',
    { from_date: fromDate, to_date: toDate, shop_id: shopId },
    { responseType: 'raw' },
  );

export const getTapinInvoicesBulk = (orderIds: number[], shopId?: string) =>
  tapinRequest<Response>(
    'order/post/detail/html/bulk',
    { orders_id: orderIds, shop_id: shopId },
    { responseType: 'raw' },
  );

export const getTapinStatusDaily = (date: string, page = 1, shopId?: string) =>
  tapinRequest<{ list: unknown[]; total_count: number }>('order/post/change-status/report', {
    date,
    page,
    count: 200,
    shop_id: shopId,
  });

export const getTapinStatusRange = (fromDate: string, toDate: string, page = 1, shopId?: string) =>
  tapinRequest<{ list: unknown[]; total_count: number }>(
    'order/post/change-status/report/last-change-status',
    { from_date: fromDate, to_date: toDate, page, count: 200, shop_id: shopId },
  );

export const getTapinOrderItemsDocument = (orderId: number) =>
  tapinRequest<Response>(`order/post/detail/list/html/${orderId}`, undefined, {
    method: 'GET',
    responseType: 'raw',
    retrySafe: true,
  });

export type TapinShopInput = {
  shop_name: string;
  first_name: string;
  last_name: string;
  email: string;
  father_name: string;
  phone?: string;
  mobile: string;
  birth_date: string;
  certificate_code: string;
  certificate_serial_number: string;
  birthday_location: string;
  national_code: string;
  address: string;
  province: number;
  city: number;
  postal_code: string;
  unit: string;
  floor: string;
  plaque: string;
  latitude: number;
  longitude: number;
  website: string;
  available_hours: string;
  instagram_id: string;
  shop_description?: string;
  logo_image: string;
  id_cart_image: string;
  is_legal_shop: boolean;
  company_name?: string;
  economic_code?: string;
  company_national_code?: string;
  register_code?: string;
};

export const createTapinShop = (input: TapinShopInput) =>
  tapinRequest<{ id: string }>('shop/create', input);
