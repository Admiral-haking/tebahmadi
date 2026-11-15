export type AdminRole = "owner" | "admin" | "manager" | "support";

export type AdminNavigationItem = {
  id: string;
  label: string;
  href?: string;
  badge?: string;
};

export type AdminNavigationSection = {
  label: string;
  items: AdminNavigationItem[];
};

const privilegedRoles: AdminRole[] = ["owner", "admin", "manager"];
const supportRoles: AdminRole[] = [...privilegedRoles, "support"];

const hasRole = (role: AdminRole, roles: AdminRole[]) => roles.includes(role);

export function getAdminNavigation(role: AdminRole, openTickets = 0): AdminNavigationSection[] {
  const sections: AdminNavigationSection[] = [
    {
      label: "فروش",
      items: [
        { id: "dashboard", label: "داشبورد" },
        { id: "orders", label: "سفارش‌ها" },
        { id: "operations", label: "مرکز سفارش و ارسال", href: "/admin/order-center" },
      ],
    },
    {
      label: "کاتالوگ",
      items: [
        { id: "products", label: "محصولات و واریانت‌ها" },
        { id: "inventory", label: "موجودی و گردش کالا" },
        { id: "supply", label: "تأمین و خرید" },
        { id: "content", label: "محتوای محصول" },
        { id: "promotions", label: "کدهای تخفیف" },
        { id: "campaigns", label: "جشنواره‌ها" },
      ],
    },
    {
      label: "عملیات",
      items: [
        { id: "finance", label: "مالی و فاکتورها" },
        { id: "returns", label: "مرجوعی‌ها" },
        { id: "crm", label: "مشتریان و CRM" },
      ],
    },
    {
      label: "ارتباط",
      items: [
        { id: "contacts", label: "پیام‌های تماس" },
        { id: "support", label: "تیکت‌های پشتیبانی", ...(openTickets > 0 ? { badge: new Intl.NumberFormat("fa-IR").format(openTickets) } : {}) },
      ],
    },
    {
      label: "سیستم",
      items: [
        { id: "users", label: "کاربران و نقش‌ها" },
        { id: "settings", label: "تنظیمات اتصال" },
      ],
    },
  ];

  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        if (item.id === "users") return role === "owner";
        if (item.id === "operations") return hasRole(role, privilegedRoles);
        if (["products", "inventory", "supply", "content", "promotions", "campaigns", "finance", "crm"].includes(item.id)) return hasRole(role, privilegedRoles);
        if (item.id === "settings") return hasRole(role, privilegedRoles);
        return hasRole(role, supportRoles);
      }),
    }))
    .filter((section) => section.items.length > 0);
}
