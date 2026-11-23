export const DEVELOPER_MENU_ITEMS = [
  { title: "کنترل کیفیت پرداخت‌ها", href: "/admin/payment-quality" },
  { title: "مدیریت درگاه‌های پرداخت", href: "/admin/payment-gateways" },
  { title: "لاگ خطاها", href: "/admin/error-logs" },
] as const;

const DEVELOPER_MENU_HREFS = new Set<string>(DEVELOPER_MENU_ITEMS.map((item) => item.href));

export function isDeveloperMenuHref(href: string): boolean {
  return DEVELOPER_MENU_HREFS.has(href);
}
