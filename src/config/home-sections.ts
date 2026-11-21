export type HomeSectionKind =
    | "hero"
    | "categories"
    | "offers"
    | "newest"
    | "popular"
    | "education"
    | "articles"
    | "trust";

export type HomeSectionConfig = {
    id: string;
    kind: HomeSectionKind;
    title: string;
    subtitle?: string;
    enabled: boolean;
    order: number;
    href?: string;
    ctaLabel?: string;
};

export const DEFAULT_HOME_SECTIONS: readonly HomeSectionConfig[] = [
    {
        id: "hero",
        kind: "hero",
        title: "فروشگاه تخصصی گیاهان دارویی و محصولات طبیعی طب احمدی",
        subtitle: "گیاهان دست‌چین، دمنوش‌های خالص، روغن‌های طبیعی و عسل کوهستان با ارسال مطمئن به سراسر کشور",
        enabled: true,
        order: 1,
        href: "/store",
        ctaLabel: "مشاهده فروشگاه",
    },
    {
        id: "categories",
        kind: "categories",
        title: "دسته‌بندی محصولات طبیعی",
        subtitle: "انتخاب سریع بر اساس نوع محصول",
        enabled: true,
        order: 2,
        href: "/store",
        ctaLabel: "همه دسته‌ها",
    },
    {
        id: "offers",
        kind: "offers",
        title: "پیشنهادهای شگفت‌انگیز طب احمدی",
        subtitle: "منتخب محصولات طبیعی با تخفیف فعال",
        enabled: true,
        order: 3,
        href: "/store?discount=1",
        ctaLabel: "مشاهده همه",
    },
    {
        id: "newest",
        kind: "newest",
        title: "تازه‌ترین محصولات",
        subtitle: "برداشت و بسته‌بندی تازه فصل",
        enabled: true,
        order: 4,
        href: "/store?sort=newest",
        ctaLabel: "مشاهده همه",
    },
    {
        id: "popular",
        kind: "popular",
        title: "پرفروش‌ترین محصولات طب احمدی",
        subtitle: "محبوب‌ترین انتخاب‌های مشتریان",
        enabled: true,
        order: 5,
        href: "/store",
        ctaLabel: "مشاهده همه",
    },
    {
        id: "education",
        kind: "education",
        title: "راهنمای اصولی مصرف و نگهداری گیاهان دارویی",
        subtitle: "چگونه عطر، خواص و تازگی دمنوش‌ها، روغن‌ها و عرقیات را حفظ کنیم؟",
        enabled: true,
        order: 6,
        href: "/blog",
        ctaLabel: "مطالعه راهنما در مجله",
    },
    {
        id: "articles",
        kind: "articles",
        title: "مطالب منتخب مجله طب احمدی",
        subtitle: "نکات کاربردی درباره دم‌آوری، نگهداری و شناخت ترکیبات طبیعی",
        enabled: true,
        order: 7,
        href: "/blog",
        ctaLabel: "همه مقالات",
    },
    {
        id: "trust",
        kind: "trust",
        title: "چرا خرید از طب احمدی؟",
        enabled: true,
        order: 8,
    },
];

export function resolveHomeSections(
    overrides?: Partial<Record<HomeSectionKind, Partial<HomeSectionConfig>>> | null,
): HomeSectionConfig[] {
    return DEFAULT_HOME_SECTIONS.map((section) => {
        const override = overrides?.[section.kind];
        return override ? { ...section, ...override, kind: section.kind } : { ...section };
    })
        .filter((section) => section.enabled)
        .sort((a, b) => a.order - b.order);
}
