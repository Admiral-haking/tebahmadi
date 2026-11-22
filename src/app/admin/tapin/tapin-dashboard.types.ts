export type TapinOrder = {
  id: string;
  order_id: number;
  barcode: string;
  status: number;
  first_name: string;
  last_name: string;
  mobile: string;
  created_at: string;
};

export type TapinOverview = {
  credit: number;
  linked: number;
  active: number;
  syncFailures: number;
  remote: { list: TapinOrder[]; total_count: number };
  shop: {
    title: string;
    status_display: string;
    owner_first_name: string;
    owner_last_name: string;
    owner_mobile: string;
    address: string;
  };
  shops: { list: Array<{ id: string; title: string }>; total_count: number };
  transactions: {
    list: Array<{
      id: string;
      price: number;
      pay_type_description: string;
      status_description: string;
      create_at: string;
    }>;
  };
  tasks: {
    list: Array<{ id: string; task_type: number; task_status: number; created_at: string }>;
  };
  warnings: string[];
  syncHealth: {
    enabled: boolean;
    running: boolean;
    lastRunAt: string | null;
    lastResult: {
      checked: number;
      updated: number;
      failed: number;
      at: string;
      error?: string;
    } | null;
  };
  customers: {
    list: Array<{
      customer_id: string;
      first_name: string;
      last_name: string;
      mobile: string;
      created_at: string;
    }>;
    total_count: number;
  };
  employees: {
    list: Array<{ first_name: string; last_name: string; username: string; employee_code: string }>;
    total_count: number;
  };
};

export const TAPIN_TASK_TYPES: Record<number, string> = {
  0: 'ورودی اکسل',
  1: 'تغییر وضعیت گروهی',
  2: 'خروجی اکسل',
  3: 'خروجی PDF',
  4: 'ثبت گروهی',
};
export const TAPIN_TASK_STATUSES: Record<number, string> = {
  0: 'ثبت شده',
  1: 'در حال بررسی',
  2: 'در حال انجام',
  3: 'تکمیل شده',
  4: 'خطا',
};
