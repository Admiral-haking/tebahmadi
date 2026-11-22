import type { ProductCardProps } from "@/components/product";
import type { StoreCategoryContext, StoreCategorySummary, StoreFilterAttribute } from "@/views/store/data";
import type { ProductDetailData } from "@/views/product/data";
import type { BlogIndexData, BlogPostData, BlogPostListItem, BlogCategoryItem } from "@/views/blog/data";
import { BRAND, DEFAULT_SITE_INFO } from "@/config/brand";

/**
 * Returns true when a real MongoDB URI is configured in the environment.
 * When false (e.g., local UI preview sandbox without a database), data loaders
 * gracefully serve deterministic Teb Ahmadi catalog data so the storefront renders
 * cleanly without hanging or throwing. In production with MONGO_URI configured,
 * real MongoDB queries always execute.
 */
export function isMongoConfigured(): boolean {
    return Boolean(process.env.MONGO_URI && process.env.MONGO_URI.trim().length > 0);
}

export type PreviewCategory = StoreCategorySummary & {
    icon: string;
    description: string;
    imageUrl: string;
    ancestors: string[];
    isActive: boolean;
    position: number;
};

export const PREVIEW_CATEGORIES: PreviewCategory[] = [
    {
        id: "cat-herbs",
        name: "گیاهان دارویی",
        slug: "medicinal-herbs",
        path: "medicinal-herbs",
        depth: 0,
        parentId: null,
        imageId: null,
        mediaId: null,
        icon: "leaf",
        description: "گیاهان دارویی خشک‌شده به روش اصولی با حفظ عطر و اسانس طبیعی",
        imageUrl: "/images/tebahmadi/education-panel.jpg",
        ancestors: [],
        isActive: true,
        position: 1,
    },
    {
        id: "cat-teas",
        name: "دمنوش‌های طبیعی",
        slug: "herbal-teas",
        path: "herbal-teas",
        depth: 0,
        parentId: null,
        imageId: null,
        mediaId: null,
        icon: "cup",
        description: "ترکیب‌های آرامش‌بخش، گوارشی و روزانه از گل‌ها و برگ‌های دست‌چین",
        imageUrl: "/images/tebahmadi/herbal-tea.jpg",
        ancestors: [],
        isActive: true,
        position: 2,
    },
    {
        id: "cat-oils",
        name: "روغن‌های گیاهی",
        slug: "natural-oils",
        path: "natural-oils",
        depth: 0,
        parentId: null,
        imageId: null,
        mediaId: null,
        icon: "droplet",
        description: "روغن‌های خالص پرس سرد ویژه مراقبت پوست، مو و ماساژ",
        imageUrl: "/images/tebahmadi/natural-oil.jpg",
        ancestors: [],
        isActive: true,
        position: 3,
    },
    {
        id: "cat-honey",
        name: "عسل و فرآورده‌ها",
        slug: "honey-natural",
        path: "honey-natural",
        depth: 0,
        parentId: null,
        imageId: null,
        mediaId: null,
        icon: "sun",
        description: "عسل طبیعی کوهستان، بره موم و گرده گل خالص از زنبورستان‌های منتخب",
        imageUrl: "/images/tebahmadi/mountain-honey.jpg",
        ancestors: [],
        isActive: true,
        position: 4,
    },
    {
        id: "cat-distillates",
        name: "عرقیات سنتی",
        slug: "herbal-distillates",
        path: "herbal-distillates",
        depth: 0,
        parentId: null,
        imageId: null,
        mediaId: null,
        icon: "flask",
        description: "عرقیات دوآتشه و خالص با تقطیر سنتی و بسته‌بندی ایمن",
        imageUrl: "/images/tebahmadi/hero-herbs.jpg",
        ancestors: [],
        isActive: true,
        position: 5,
    },
    {
        id: "cat-spices",
        name: "زعفران و ادویه",
        slug: "saffron-spices",
        path: "saffron-spices",
        depth: 0,
        parentId: null,
        imageId: null,
        mediaId: null,
        icon: "sparkles",
        description: "زعفران سرگل قائنات و ادویه‌های تازه آسیاب‌شده بدون افزودنی",
        imageUrl: "/images/tebahmadi/hero-herbs.jpg",
        ancestors: [],
        isActive: true,
        position: 6,
    },
];

type PreviewProductRecord = {
    card: ProductCardProps;
    categorySlug: string;
    categoryName: string;
    categoryId: string;
    createdAt: string;
    isPopular: boolean;
    detail: ProductDetailData;
};

export const PREVIEW_PRODUCTS: PreviewProductRecord[] = [
    {
        categorySlug: "herbal-teas",
        categoryName: "دمنوش‌های طبیعی",
        categoryId: "cat-teas",
        createdAt: "2026-11-18T10:00:00.000Z",
        isPopular: true,
        card: {
            id: "prod-borage-chamomile",
            slug: "borage-chamomile-herbal-tea",
            title: "دمنوش آرامش‌بخش گل‌گاوزبان، بابونه و بهارنارنج طب احمدی",
            variantSubtitle: "بسته ۱۵۰ گرمی شیشه‌ای",
            finalPrice: 248000,
            originalPrice: 295000,
            discountPercent: 16,
            inStock: true,
            stockCount: 18,
            rating: 4.9,
            reviewCount: 42,
            imageUrl: "/images/tebahmadi/herbal-tea.jpg",
            sizes: ["۱۵۰ گرم", "۳۰۰ گرم"],
        },
        detail: {
            id: "prod-borage-chamomile",
            slug: "borage-chamomile-herbal-tea",
            title: "دمنوش آرامش‌بخش گل‌گاوزبان، بابونه و بهارنارنج طب احمدی",
            description:
                "معرفی: ترکیب دست‌چین گل‌گاوزبان کوهی، بابونه شیرازی و گل بهارنارنج تازه بدون هرگونه اسانس مصنوعی. مناسب برای ایجاد آرامش عصرگاهی و رفع خستگی روزانه.\n\nترکیبات: گل‌گاوزبان خالص ۵۰٪، بابونه شیرازی ۳۰٪، بهارنارنج معطر ۲۰٪.\n\nروش مصرف: یک قاشق غذاخوری از مخلوط را در قوری با ۳۰۰ میلی‌لیتر آب ۸۵ درجه بریزید و ۱۰ تا ۱۲ دقیقه دم کنید. در صورت تمایل با چند قطره لیموی تازه یا عسل میل شود.\n\nهشدار مصرف: در دوران بارداری، شیردهی یا مصرف داروهای فشار خون پیش از استفاده با پزشک مشورت کنید. در ظرف دربسته، دور از نور مستقیم و رطوبت نگهداری شود.",
            brand: BRAND.name,
            categories: [{ id: "cat-teas", name: "دمنوش‌های طبیعی", path: "herbal-teas" }],
            productTypeId: "pt-herbal",
            productTypeName: "دمنوش‌های طبیعی",
            activeVariantCount: 2,
            hasInventory: true,
            sizeAttributeLabel: "وزن بسته",
            variantAttributes: [
                {
                    key: "weight",
                    label: "وزن بسته",
                    kind: "enum",
                    isColor: false,
                    options: [
                        { value: "۱۵۰ گرم", label: "بسته ۱۵۰ گرمی", variantIds: ["var-bc-150"] },
                        { value: "۳۰۰ گرم", label: "بسته ۳۰۰ گرمی اقتصادی", variantIds: ["var-bc-300"] },
                    ],
                },
            ],
            variants: [
                {
                    id: "var-bc-150",
                    sku: "TA-TEA-150",
                    priceModel: "fixed",
                    unitPrice: 295000,
                    finalPrice: 248000,
                    discountPercent: 16,
                    offerAmount: 47000,
                    offerLabel: "پیشنهاد فصل",
                    inventoryQuantity: 18,
                    inventoryTrackingUnit: "unit",
                    attributes: [{ key: "weight", value: "۱۵۰ گرم" }],
                    attributesSummary: "وزن بسته: ۱۵۰ گرم",
                    attributeEntries: [
                        { label: "وزن بسته", value: "۱۵۰ گرم" },
                        { label: "بسته‌بندی", value: "ظرف شیشه‌ای درب چوب‌پنبه‌ای" },
                    ],
                    variantAttributeValues: { weight: "۱۵۰ گرم" },
                    weightGramsPerUnit: 150,
                    media: [
                        { id: "m-1", previewUrl: "/images/tebahmadi/herbal-tea.jpg", fullUrl: "/images/tebahmadi/herbal-tea.jpg", url: "/images/tebahmadi/herbal-tea.jpg" },
                        { id: "m-2", previewUrl: "/images/tebahmadi/hero-herbs.jpg", fullUrl: "/images/tebahmadi/hero-herbs.jpg", url: "/images/tebahmadi/hero-herbs.jpg" },
                    ],
                },
                {
                    id: "var-bc-300",
                    sku: "TA-TEA-300",
                    priceModel: "fixed",
                    unitPrice: 540000,
                    finalPrice: 465000,
                    discountPercent: 14,
                    offerAmount: 75000,
                    inventoryQuantity: 11,
                    inventoryTrackingUnit: "unit",
                    attributes: [{ key: "weight", value: "۳۰۰ گرم" }],
                    attributesSummary: "وزن بسته: ۳۰۰ گرم",
                    attributeEntries: [
                        { label: "وزن بسته", value: "۳۰۰ گرم" },
                        { label: "بسته‌بندی", value: "بسته زیپ‌کیپ دولایه ضد نور" },
                    ],
                    variantAttributeValues: { weight: "۳۰۰ گرم" },
                    weightGramsPerUnit: 300,
                    media: [
                        { id: "m-1b", previewUrl: "/images/tebahmadi/herbal-tea.jpg", fullUrl: "/images/tebahmadi/herbal-tea.jpg", url: "/images/tebahmadi/herbal-tea.jpg" },
                    ],
                },
            ],
            reviews: [
                {
                    id: "rev-1",
                    rating: 5,
                    author: "مریم کاظمی",
                    comment: "عطر بهارنارنج و تازگی گل‌ها فوق‌العاده است. بسته‌بندی کاملاً تمیز و سریع به دستم رسید.",
                    createdAt: "2026-11-10T09:30:00.000Z",
                    variantSummary: "وزن بسته: ۱۵۰ گرم",
                },
                {
                    id: "rev-2",
                    rating: 5,
                    author: "سعید مرادی",
                    comment: "کیفیت گل‌گاوزبان واقعاً عالی و بدون خرده ساقه بود. حتماً مجدد سفارش می‌دهم.",
                    createdAt: "2026-11-02T14:15:00.000Z",
                    variantSummary: "وزن بسته: ۳۰۰ گرم",
                },
            ],
            productFacts: [],
            reviewStats: { averageRating: 4.9, total: 42 },
        },
    },
    {
        categorySlug: "natural-oils",
        categoryName: "روغن‌های گیاهی",
        categoryId: "cat-oils",
        createdAt: "2026-11-16T08:00:00.000Z",
        isPopular: true,
        card: {
            id: "prod-rosemary-oil",
            slug: "cold-pressed-rosemary-olive-oil",
            title: "روغن خالص رزماری پرس سرد (مراقبت مو و پوست سر)",
            variantSubtitle: "بطری قطره چکان ۶۰ میلی‌لیتر",
            finalPrice: 315000,
            originalPrice: 370000,
            discountPercent: 15,
            inStock: true,
            stockCount: 14,
            rating: 4.8,
            reviewCount: 31,
            imageUrl: "/images/tebahmadi/natural-oil.jpg",
            sizes: ["۶۰ میلی‌لیتر", "۱۲۰ میلی‌لیتر"],
        },
        detail: {
            id: "prod-rosemary-oil",
            slug: "cold-pressed-rosemary-olive-oil",
            title: "روغن خالص رزماری پرس سرد (مراقبت مو و پوست سر)",
            description:
                "معرفی: روغن رزماری خالص استخراج‌شده به روش پرس سرد بدون حلال شیمیایی و پارافین، در بطری شیشه‌ای کهربایی ضد نور جهت حفظ پایداری ترکیبات مؤثره.\n\nترکیبات: عصاره روغنی برگ رزماری تازه در پایه روغن زیتون فرابکر خالص.\n\nروش مصرف: ۵ تا ۸ قطره را به آرامی روی پوست سر ماساژ دهید و پس از ۴۵ تا ۶۰ دقیقه با شامپوی ملایم شست‌وشو دهید. هفته‌ای ۲ تا ۳ نوبت قابل استفاده است.\n\nهشدار مصرف: صرفاً جهت مصرف موضعی. پیش از اولین استفاده روی بخش کوچکی از پوست ساعد تست حساسیت انجام دهید. دور از گرما و نور مستقیم آفتاب نگهداری شود.",
            brand: BRAND.name,
            categories: [{ id: "cat-oils", name: "روغن‌های گیاهی", path: "natural-oils" }],
            productTypeId: "pt-oils",
            productTypeName: "روغن‌های گیاهی",
            activeVariantCount: 2,
            hasInventory: true,
            sizeAttributeLabel: "حجم بطری",
            variantAttributes: [
                {
                    key: "volume",
                    label: "حجم بطری",
                    kind: "enum",
                    isColor: false,
                    options: [
                        { value: "۶۰ میلی‌لیتر", label: "بطری ۶۰ میلی‌لیتر", variantIds: ["var-oil-60"] },
                        { value: "۱۲۰ میلی‌لیتر", label: "بطری ۱۲۰ میلی‌لیتر", variantIds: ["var-oil-120"] },
                    ],
                },
            ],
            variants: [
                {
                    id: "var-oil-60",
                    sku: "TA-OIL-60",
                    priceModel: "fixed",
                    unitPrice: 370000,
                    finalPrice: 315000,
                    discountPercent: 15,
                    offerAmount: 55000,
                    inventoryQuantity: 14,
                    inventoryTrackingUnit: "unit",
                    attributes: [{ key: "volume", value: "۶۰ میلی‌لیتر" }],
                    attributesSummary: "حجم بطری: ۶۰ میلی‌لیتر",
                    attributeEntries: [
                        { label: "حجم بطری", value: "۶۰ میلی‌لیتر" },
                        { label: "روش استخراج", value: "پرس سرد بدون حلال" },
                    ],
                    variantAttributeValues: { volume: "۶۰ میلی‌لیتر" },
                    weightGramsPerUnit: 140,
                    media: [
                        { id: "m-o1", previewUrl: "/images/tebahmadi/natural-oil.jpg", fullUrl: "/images/tebahmadi/natural-oil.jpg", url: "/images/tebahmadi/natural-oil.jpg" },
                    ],
                },
                {
                    id: "var-oil-120",
                    sku: "TA-OIL-120",
                    priceModel: "fixed",
                    unitPrice: 680000,
                    finalPrice: 590000,
                    discountPercent: 13,
                    offerAmount: 90000,
                    inventoryQuantity: 7,
                    inventoryTrackingUnit: "unit",
                    attributes: [{ key: "volume", value: "۱۲۰ میلی‌لیتر" }],
                    attributesSummary: "حجم بطری: ۱۲۰ میلی‌لیتر",
                    attributeEntries: [
                        { label: "حجم بطری", value: "۱۲۰ میلی‌لیتر" },
                        { label: "روش استخراج", value: "پرس سرد بدون حلال" },
                    ],
                    variantAttributeValues: { volume: "۱۲۰ میلی‌لیتر" },
                    weightGramsPerUnit: 260,
                    media: [
                        { id: "m-o2", previewUrl: "/images/tebahmadi/natural-oil.jpg", fullUrl: "/images/tebahmadi/natural-oil.jpg", url: "/images/tebahmadi/natural-oil.jpg" },
                    ],
                },
            ],
            reviews: [
                {
                    id: "rev-o1",
                    rating: 5,
                    author: "الهام رضایی",
                    comment: "بوی کاملاً طبیعی رزماری می‌دهد و اصلاً حالت چربی سنگین و مصنوعی ندارد.",
                    createdAt: "2026-11-12T12:00:00.000Z",
                    variantSummary: "حجم بطری: ۶۰ میلی‌لیتر",
                },
            ],
            productFacts: [],
            reviewStats: { averageRating: 4.8, total: 31 },
        },
    },
    {
        categorySlug: "honey-natural",
        categoryName: "عسل و فرآورده‌ها",
        categoryId: "cat-honey",
        createdAt: "2026-11-15T11:00:00.000Z",
        isPopular: true,
        card: {
            id: "prod-thyme-honey",
            slug: "raw-mountain-thyme-honey",
            title: "عسل خام کوهستان آویشن وحشی (برداشت ارتفاعات زاگرس)",
            variantSubtitle: "شیشه ۵۰۰ گرمی خالص",
            finalPrice: 540000,
            originalPrice: 620000,
            discountPercent: 13,
            inStock: true,
            stockCount: 4,
            rating: 5.0,
            reviewCount: 54,
            imageUrl: "/images/tebahmadi/mountain-honey.jpg",
            sizes: ["۵۰۰ گرم", "۹۰۰ گرم"],
        },
        detail: {
            id: "prod-thyme-honey",
            slug: "raw-mountain-thyme-honey",
            title: "عسل خام کوهستان آویشن وحشی (برداشت ارتفاعات زاگرس)",
            description:
                "معرفی: عسل خام و حرارت‌ندیده آویشن وحشی با ساکارز پایین و عطر اصیل گیاهان مرتعی کوهستان. فیلتر نشده به روش صنعتی تا آنزیم‌ها و گرده طبیعی عسل حفظ شود.\n\nترکیبات: ۱۰۰٪ عسل طبیعی شهد گل آویشن و گیاهان کوهی، بدون شکر و افزودنی.\n\nروش مصرف: یک قاشق چای‌خوری ناشتا یا همراه با دمنوش ولرم (دمای کمتر از ۴۵ درجه) میل شود.\n\nهشدار مصرف: مصرف عسل برای کودکان زیر یک سال مجاز نیست. در دمای محیط و به دور از نور مستقیم نگهداری شود؛ شکرک زدن طبیعی نشانه خلوص عسل خام است.",
            brand: BRAND.name,
            categories: [{ id: "cat-honey", name: "عسل و فرآورده‌ها", path: "honey-natural" }],
            productTypeId: "pt-honey",
            productTypeName: "عسل و فرآورده‌ها",
            activeVariantCount: 2,
            hasInventory: true,
            sizeAttributeLabel: "وزن خالص",
            variantAttributes: [
                {
                    key: "weight",
                    label: "وزن خالص",
                    kind: "enum",
                    isColor: false,
                    options: [
                        { value: "۵۰۰ گرم", label: "شیشه ۵۰۰ گرمی", variantIds: ["var-h-500"] },
                        { value: "۹۰۰ گرم", label: "شیشه ۹۰۰ گرمی", variantIds: ["var-h-900"] },
                    ],
                },
            ],
            variants: [
                {
                    id: "var-h-500",
                    sku: "TA-HNY-500",
                    priceModel: "fixed",
                    unitPrice: 620000,
                    finalPrice: 540000,
                    discountPercent: 13,
                    offerAmount: 80000,
                    inventoryQuantity: 4,
                    inventoryTrackingUnit: "unit",
                    attributes: [{ key: "weight", value: "۵۰۰ گرم" }],
                    attributesSummary: "وزن خالص: ۵۰۰ گرم",
                    attributeEntries: [
                        { label: "وزن خالص", value: "۵۰۰ گرم" },
                        { label: "منطقه برداشت", value: "مراتع کوهستانی زاگرس" },
                    ],
                    variantAttributeValues: { weight: "۵۰۰ گرم" },
                    weightGramsPerUnit: 720,
                    media: [
                        { id: "m-h1", previewUrl: "/images/tebahmadi/mountain-honey.jpg", fullUrl: "/images/tebahmadi/mountain-honey.jpg", url: "/images/tebahmadi/mountain-honey.jpg" },
                    ],
                },
                {
                    id: "var-h-900",
                    sku: "TA-HNY-900",
                    priceModel: "fixed",
                    unitPrice: 1080000,
                    finalPrice: 960000,
                    discountPercent: 11,
                    offerAmount: 120000,
                    inventoryQuantity: 6,
                    inventoryTrackingUnit: "unit",
                    attributes: [{ key: "weight", value: "۹۰۰ گرم" }],
                    attributesSummary: "وزن خالص: ۹۰۰ گرم",
                    attributeEntries: [
                        { label: "وزن خالص", value: "۹۰۰ گرم" },
                        { label: "منطقه برداشت", value: "مراتع کوهستانی زاگرس" },
                    ],
                    variantAttributeValues: { weight: "۹۰۰ گرم" },
                    weightGramsPerUnit: 1200,
                    media: [
                        { id: "m-h2", previewUrl: "/images/tebahmadi/mountain-honey.jpg", fullUrl: "/images/tebahmadi/mountain-honey.jpg", url: "/images/tebahmadi/mountain-honey.jpg" },
                    ],
                },
            ],
            reviews: [
                {
                    id: "rev-h1",
                    rating: 5,
                    author: "حسین طاهری",
                    comment: "طعم آویشن واقعی کاملاً محسوس است و بسته‌بندی ضدضربه عالی داشت.",
                    createdAt: "2026-11-14T16:40:00.000Z",
                    variantSummary: "وزن خالص: ۵۰۰ گرم",
                },
            ],
            productFacts: [],
            reviewStats: { averageRating: 5.0, total: 54 },
        },
    },
    {
        categorySlug: "medicinal-herbs",
        categoryName: "گیاهان دارویی",
        categoryId: "cat-herbs",
        createdAt: "2026-11-14T10:00:00.000Z",
        isPopular: true,
        card: {
            id: "prod-mountain-thyme",
            slug: "wild-mountain-thyme-leaves",
            title: "آویشن شیرازی کوهی دست‌چین (برگ پاک‌شده)",
            variantSubtitle: "بسته ۲۰۰ گرمی",
            finalPrice: 168000,
            originalPrice: 198000,
            discountPercent: 15,
            inStock: true,
            stockCount: 25,
            rating: 4.8,
            reviewCount: 28,
            imageUrl: "/images/tebahmadi/education-panel.jpg",
            sizes: ["۲۰۰ گرم", "۵۰۰ گرم"],
        },
        detail: {
            id: "prod-mountain-thyme",
            slug: "wild-mountain-thyme-leaves",
            title: "آویشن شیرازی کوهی دست‌چین (برگ پاک‌شده)",
            description:
                "معرفی: برگ پاک‌شده آویشن کوهی شیرازی خشک‌شده در سایه برای حفظ حداکثری عطر تیمول و خواص گیاهی.\n\nترکیبات: ۱۰۰٪ برگ آویشن شیرازی کوهی بدون ساقه و ناخالصی.\n\nروش مصرف: به صورت دمنوش (یک قاشق مرباخوری در یک لیوان آب جوش به مدت ۷ دقیقه) یا به‌عنوان چاشنی معطر غذاها.\n\nهشدار مصرف: در دوران بارداری و برای افراد دارای حساسیت به گیاهان خانواده نعناع با احتیاط مصرف شود.",
            brand: BRAND.name,
            categories: [{ id: "cat-herbs", name: "گیاهان دارویی", path: "medicinal-herbs" }],
            productTypeId: "pt-herbs",
            productTypeName: "گیاهان دارویی",
            activeVariantCount: 1,
            hasInventory: true,
            sizeAttributeLabel: "وزن بسته",
            variantAttributes: [
                {
                    key: "weight",
                    label: "وزن بسته",
                    kind: "enum",
                    isColor: false,
                    options: [{ value: "۲۰۰ گرم", label: "بسته ۲۰۰ گرمی", variantIds: ["var-th-200"] }],
                },
            ],
            variants: [
                {
                    id: "var-th-200",
                    sku: "TA-HRB-200",
                    priceModel: "fixed",
                    unitPrice: 198000,
                    finalPrice: 168000,
                    discountPercent: 15,
                    offerAmount: 30000,
                    inventoryQuantity: 25,
                    inventoryTrackingUnit: "unit",
                    attributes: [{ key: "weight", value: "۲۰۰ گرم" }],
                    attributesSummary: "وزن بسته: ۲۰۰ گرم",
                    attributeEntries: [{ label: "وزن بسته", value: "۲۰۰ گرم" }],
                    variantAttributeValues: { weight: "۲۰۰ گرم" },
                    weightGramsPerUnit: 200,
                    media: [
                        { id: "m-t1", previewUrl: "/images/tebahmadi/education-panel.jpg", fullUrl: "/images/tebahmadi/education-panel.jpg", url: "/images/tebahmadi/education-panel.jpg" },
                    ],
                },
            ],
            reviews: [],
            productFacts: [],
            reviewStats: { averageRating: 4.8, total: 28 },
        },
    },
    {
        categorySlug: "saffron-spices",
        categoryName: "زعفران و ادویه",
        categoryId: "cat-spices",
        createdAt: "2026-11-13T10:00:00.000Z",
        isPopular: true,
        card: {
            id: "prod-sargol-saffron",
            slug: "qaenat-sargol-saffron-1mithqal",
            title: "زعفران سرگل ممتاز قائنات (بسته‌بندی خاتم یک مثقالی)",
            variantSubtitle: "۱ مثقال (۴.۶ گرم)",
            finalPrice: 685000,
            originalPrice: 760000,
            discountPercent: 10,
            inStock: true,
            stockCount: 9,
            rating: 4.9,
            reviewCount: 37,
            imageUrl: "/images/tebahmadi/hero-herbs.jpg",
            sizes: ["۱ مثقال", "نیم مثقال"],
        },
        detail: {
            id: "prod-sargol-saffron",
            slug: "qaenat-sargol-saffron-1mithqal",
            title: "زعفران سرگل ممتاز قائنات (بسته‌بندی خاتم یک مثقالی)",
            description:
                "معرفی: کلاله‌های تمام قرمز زعفران سرگل برداشت تازه قائنات با قدرت رنگ‌دهی بالا و عطر ماندگار.\n\nترکیبات: ۱۰۰٪ کلاله زعفران خالص قائنات.\n\nروش مصرف: پس از سابیدن با یک تکه یخ یا آب جوش دم بگذارید تا حداکثر رنگ و عطر آزاد شود.\n\nهشدار مصرف: در جای خشک، خنک و دور از نور نگهداری شود.",
            brand: BRAND.name,
            categories: [{ id: "cat-spices", name: "زعفران و ادویه", path: "saffron-spices" }],
            productTypeId: "pt-spices",
            productTypeName: "زعفران و ادویه",
            activeVariantCount: 1,
            hasInventory: true,
            sizeAttributeLabel: "وزن",
            variantAttributes: [
                {
                    key: "weight",
                    label: "وزن",
                    kind: "enum",
                    isColor: false,
                    options: [{ value: "۱ مثقال", label: "۱ مثقال (۴.۶ گرم)", variantIds: ["var-saf-1"] }],
                },
            ],
            variants: [
                {
                    id: "var-saf-1",
                    sku: "TA-SAF-01",
                    priceModel: "fixed",
                    unitPrice: 760000,
                    finalPrice: 685000,
                    discountPercent: 10,
                    offerAmount: 75000,
                    inventoryQuantity: 9,
                    inventoryTrackingUnit: "unit",
                    attributes: [{ key: "weight", value: "۱ مثقال" }],
                    attributesSummary: "وزن: ۱ مثقال (۴.۶ گرم)",
                    attributeEntries: [{ label: "وزن", value: "۴.۶ گرم (یک مثقال)" }],
                    variantAttributeValues: { weight: "۱ مثقال" },
                    weightGramsPerUnit: 50,
                    media: [
                        { id: "m-s1", previewUrl: "/images/tebahmadi/hero-herbs.jpg", fullUrl: "/images/tebahmadi/hero-herbs.jpg", url: "/images/tebahmadi/hero-herbs.jpg" },
                    ],
                },
            ],
            reviews: [],
            productFacts: [],
            reviewStats: { averageRating: 4.9, total: 37 },
        },
    },
    {
        categorySlug: "herbal-teas",
        categoryName: "دمنوش‌های طبیعی",
        categoryId: "cat-teas",
        createdAt: "2026-11-12T10:00:00.000Z",
        isPopular: false,
        card: {
            id: "prod-damask-rose-tea",
            slug: "kashan-damask-rose-petals",
            title: "غنچه و گلبرگ گل محمدی کاشان (درجه یک صادراتی)",
            variantSubtitle: "بسته ۱۰۰ گرمی",
            finalPrice: 195000,
            inStock: true,
            stockCount: 20,
            rating: 4.8,
            reviewCount: 19,
            imageUrl: "/images/tebahmadi/hero-herbs.jpg",
            sizes: ["۱۰۰ گرم", "۲۵۰ گرم"],
        },
        detail: {
            id: "prod-damask-rose-tea",
            slug: "kashan-damask-rose-petals",
            title: "غنچه و گلبرگ گل محمدی کاشان (درجه یک صادراتی)",
            description:
                "معرفی: گلبرگ‌های خوش‌عطر و سالم گل محمدی کاشان، خشک‌شده به روش بهداشتی برای دمنوش، چای و شیرینی‌پزی.\n\nترکیبات: ۱۰۰٪ گلبرگ گل محمدی خالص.\n\nروش مصرف: ۴ تا ۵ غنچه یا یک قاشق گلبرگ را همراه چای یا به تنهایی در آب داغ دم کنید.\n\nهشدار مصرف: در ظرف دربسته و محیط خشک نگهداری شود.",
            brand: BRAND.name,
            categories: [{ id: "cat-teas", name: "دمنوش‌های طبیعی", path: "herbal-teas" }],
            productTypeId: "pt-herbal",
            productTypeName: "دمنوش‌های طبیعی",
            activeVariantCount: 1,
            hasInventory: true,
            sizeAttributeLabel: "وزن بسته",
            variantAttributes: [
                {
                    key: "weight",
                    label: "وزن بسته",
                    kind: "enum",
                    isColor: false,
                    options: [{ value: "۱۰۰ گرم", label: "بسته ۱۰۰ گرمی", variantIds: ["var-rose-100"] }],
                },
            ],
            variants: [
                {
                    id: "var-rose-100",
                    sku: "TA-ROS-100",
                    priceModel: "fixed",
                    unitPrice: 195000,
                    finalPrice: 195000,
                    inventoryQuantity: 20,
                    inventoryTrackingUnit: "unit",
                    attributes: [{ key: "weight", value: "۱۰۰ گرم" }],
                    attributesSummary: "وزن بسته: ۱۰۰ گرم",
                    attributeEntries: [{ label: "وزن بسته", value: "۱۰۰ گرم" }],
                    variantAttributeValues: { weight: "۱۰۰ گرم" },
                    weightGramsPerUnit: 100,
                    media: [
                        { id: "m-r1", previewUrl: "/images/tebahmadi/hero-herbs.jpg", fullUrl: "/images/tebahmadi/hero-herbs.jpg", url: "/images/tebahmadi/hero-herbs.jpg" },
                    ],
                },
            ],
            reviews: [],
            productFacts: [],
            reviewStats: { averageRating: 4.8, total: 19 },
        },
    },
    {
        categorySlug: "natural-oils",
        categoryName: "روغن‌های گیاهی",
        categoryId: "cat-oils",
        createdAt: "2026-11-11T10:00:00.000Z",
        isPopular: true,
        card: {
            id: "prod-blackseed-oil",
            slug: "cold-pressed-black-seed-oil",
            title: "روغن سیاهدانه خالص پرس سرد طب احمدی",
            variantSubtitle: "بطری شیشه‌ای ۱۰۰ میلی‌لیتر",
            finalPrice: 345000,
            originalPrice: 390000,
            discountPercent: 12,
            inStock: true,
            stockCount: 16,
            rating: 4.9,
            reviewCount: 24,
            imageUrl: "/images/tebahmadi/natural-oil.jpg",
            sizes: ["۱۰۰ میلی‌لیتر"],
        },
        detail: {
            id: "prod-blackseed-oil",
            slug: "cold-pressed-black-seed-oil",
            title: "روغن سیاهدانه خالص پرس سرد طب احمدی",
            description:
                "معرفی: روغن سیاهدانه بکر و تصفیه‌نشده، تهیه‌شده از دانه سیاهدانه تازه با دمای کنترل‌شده جهت حفظ تیموکینون طبیعی.\n\nترکیبات: ۱۰۰٪ روغن خالص دانه سیاهدانه.\n\nروش مصرف: قابل استفاده برای ماساژ مفاصل و مراقبت موضعی پوست.\n\nهشدار مصرف: در جای خنک و تاریک نگهداری شود و درب بطری پس از مصرف کاملاً بسته شود.",
            brand: BRAND.name,
            categories: [{ id: "cat-oils", name: "روغن‌های گیاهی", path: "natural-oils" }],
            productTypeId: "pt-oils",
            productTypeName: "روغن‌های گیاهی",
            activeVariantCount: 1,
            hasInventory: true,
            sizeAttributeLabel: "حجم",
            variantAttributes: [
                {
                    key: "volume",
                    label: "حجم",
                    kind: "enum",
                    isColor: false,
                    options: [{ value: "۱۰۰ میلی‌لیتر", label: "۱۰۰ میلی‌لیتر", variantIds: ["var-bs-100"] }],
                },
            ],
            variants: [
                {
                    id: "var-bs-100",
                    sku: "TA-BSO-100",
                    priceModel: "fixed",
                    unitPrice: 390000,
                    finalPrice: 345000,
                    discountPercent: 12,
                    offerAmount: 45000,
                    inventoryQuantity: 16,
                    inventoryTrackingUnit: "unit",
                    attributes: [{ key: "volume", value: "۱۰۰ میلی‌لیتر" }],
                    attributesSummary: "حجم: ۱۰۰ میلی‌لیتر",
                    attributeEntries: [{ label: "حجم", value: "۱۰۰ میلی‌لیتر" }],
                    variantAttributeValues: { volume: "۱۰۰ میلی‌لیتر" },
                    weightGramsPerUnit: 210,
                    media: [
                        { id: "m-bs1", previewUrl: "/images/tebahmadi/natural-oil.jpg", fullUrl: "/images/tebahmadi/natural-oil.jpg", url: "/images/tebahmadi/natural-oil.jpg" },
                    ],
                },
            ],
            reviews: [],
            productFacts: [],
            reviewStats: { averageRating: 4.9, total: 24 },
        },
    },
    {
        categorySlug: "herbal-distillates",
        categoryName: "عرقیات سنتی",
        categoryId: "cat-distillates",
        createdAt: "2026-11-10T10:00:00.000Z",
        isPopular: false,
        card: {
            id: "prod-mint-distillate",
            slug: "double-distilled-peppermint-water",
            title: "عرق نعناع دوآتشه سنتی (تقطیر دیگ مسی)",
            variantSubtitle: "بطری ۱ لیتری",
            finalPrice: 138000,
            inStock: true,
            stockCount: 30,
            rating: 4.7,
            reviewCount: 21,
            imageUrl: "/images/tebahmadi/herbal-tea.jpg",
            sizes: ["۱ لیتر"],
        },
        detail: {
            id: "prod-mint-distillate",
            slug: "double-distilled-peppermint-water",
            title: "عرق نعناع دوآتشه سنتی (تقطیر دیگ مسی)",
            description:
                "معرفی: عرق نعناع غلیظ و معطر تهیه‌شده از نعناع تازه بدون اسانس و مواد نگهدارنده، مناسب پس از وعده‌های غذایی.\n\nترکیبات: تقطیر طبیعی برگ و سرشاخه نعناع تازه.\n\nروش مصرف: نصف استکان پس از غذا همراه با کمی آب ولرم میل شود.\n\nهشدار مصرف: پس از باز شدن درب در یخچال نگهداری شود.",
            brand: BRAND.name,
            categories: [{ id: "cat-distillates", name: "عرقیات سنتی", path: "herbal-distillates" }],
            productTypeId: "pt-distillates",
            productTypeName: "عرقیات سنتی",
            activeVariantCount: 1,
            hasInventory: true,
            sizeAttributeLabel: "حجم",
            variantAttributes: [
                {
                    key: "volume",
                    label: "حجم",
                    kind: "enum",
                    isColor: false,
                    options: [{ value: "۱ لیتر", label: "بطری ۱ لیتری", variantIds: ["var-md-1000"] }],
                },
            ],
            variants: [
                {
                    id: "var-md-1000",
                    sku: "TA-DST-1000",
                    priceModel: "fixed",
                    unitPrice: 138000,
                    finalPrice: 138000,
                    inventoryQuantity: 30,
                    inventoryTrackingUnit: "unit",
                    attributes: [{ key: "volume", value: "۱ لیتر" }],
                    attributesSummary: "حجم: ۱ لیتر",
                    attributeEntries: [{ label: "حجم", value: "۱ لیتر" }],
                    variantAttributeValues: { volume: "۱ لیتر" },
                    weightGramsPerUnit: 1100,
                    media: [
                        { id: "m-md1", previewUrl: "/images/tebahmadi/herbal-tea.jpg", fullUrl: "/images/tebahmadi/herbal-tea.jpg", url: "/images/tebahmadi/herbal-tea.jpg" },
                    ],
                },
            ],
            reviews: [],
            productFacts: [],
            reviewStats: { averageRating: 4.7, total: 21 },
        },
    },
];

export const PREVIEW_BLOG_CATEGORIES: BlogCategoryItem[] = [
    { id: "bcat-1", name: "راهنمای دم‌آوری", slug: "brewing-guide", path: "brewing-guide", depth: 0, parentId: null, count: 2 },
    { id: "bcat-2", name: "نگهداری گیاهان", slug: "herbal-storage", path: "herbal-storage", depth: 0, parentId: null, count: 1 },
    { id: "bcat-3", name: "شناخت روغن‌ها", slug: "natural-oils-guide", path: "natural-oils-guide", depth: 0, parentId: null, count: 1 },
];

export const PREVIEW_BLOG_POSTS: Array<BlogPostListItem & { content: string }> = [
    {
        id: "post-1",
        slug: "how-to-store-medicinal-herbs",
        title: "اصول صحیح نگهداری گیاهان دارویی و دمنوش‌ها در منزل",
        excerpt: "چهار نکته ساده برای جلوگیری از افت عطر، رنگ و خواص طبیعی دمنوش‌ها و گیاهان خشک.",
        publishedAt: "2026-11-12T08:00:00.000Z",
        coverImageUrl: "/images/tebahmadi/education-panel.jpg",
        tags: ["نگهداری", "گیاهان دارویی"],
        categories: [{ id: "bcat-2", name: "نگهداری گیاهان", slug: "herbal-storage", path: "herbal-storage" }],
        content:
            "<h2>چرا شرایط نگهداری گیاهان دارویی مهم است؟</h2><p>اسانس‌های فرّار و ترکیبات معطر گیاهان دارویی در برابر نور مستقیم خورشید، گرما و رطوبت حساس‌اند. استفاده از ظروف شیشه‌ای تیره با درب محکم بهترین روش حفظ کیفیت آن‌هاست.</p><h3>نکات کلیدی</h3><ul><li>ظروف را در کابینت خنک و دور از اجاق گاز قرار دهید.</li><li>از قاشق خشک هنگام برداشتن دمنوش استفاده کنید.</li><li>تاریخ خرید و نام گیاه را روی شیشه ثبت کنید تا تازگی آن را مدیریت کنید.</li></ul>",
    },
    {
        id: "post-2",
        slug: "water-temperature-herbal-infusions",
        title: "دمای مناسب آب برای دم کردن گل‌ها، برگ‌ها و ریشه‌های گیاهی",
        excerpt: "آیا همه دمنوش‌ها را باید با آب در حال جوش دم کرد؟ تفاوت دم‌آوری بابونه، گل‌گاوزبان و دارچین.",
        publishedAt: "2026-11-08T08:00:00.000Z",
        coverImageUrl: "/images/tebahmadi/herbal-tea.jpg",
        tags: ["دمنوش", "دم‌آوری"],
        categories: [{ id: "bcat-1", name: "راهنمای دم‌آوری", slug: "brewing-guide", path: "brewing-guide" }],
        content:
            "<h2>تفاوت بافت گیاه در دم‌آوری</h2><p>گل‌ها و برگ‌های لطیف مانند بابونه و بهارنارنج در آب ۸۰ تا ۸۵ درجه بهترین عطر را آزاد می‌کنند و تلخ نمی‌شوند. اما ریشه‌ها و پوست‌های چوبی مانند دارچین و زنجبیل به حرارت بالاتر و زمان دم‌آوری طولانی‌تر نیاز دارند.</p>",
    },
    {
        id: "post-3",
        slug: "cold-pressed-oils-quality-signs",
        title: "چگونه روغن گیاهی پرس سرد اصل را تشخیص دهیم؟",
        excerpt: "نشانه‌های واقعی خلوص، رنگ، بو و بسته‌بندی استاندارد در روغن‌های گیاهی رزماری و سیاهدانه.",
        publishedAt: "2026-11-03T08:00:00.000Z",
        coverImageUrl: "/images/tebahmadi/natural-oil.jpg",
        tags: ["روغن گیاهی", "پرس سرد"],
        categories: [{ id: "bcat-3", name: "شناخت روغن‌ها", slug: "natural-oils-guide", path: "natural-oils-guide" }],
        content:
            "<h2>نشانه روغن پرس سرد واقعی</h2><p>روغن‌های پرس سرد بدون حرارت بالا و حلال شیمیایی تولید می‌شوند؛ بنابراین رنگ طبیعی دانه و رایحه خفیف گیاهی خود را حفظ می‌کنند و باید در بطری تیره عرضه شوند.</p>",
    },
    {
        id: "post-4",
        slug: "raw-mountain-honey-crystallization",
        title: "چرا عسل طبیعی کوهستان رس (شکرک) می‌بندد؟",
        excerpt: "بررسی علمی تبلور طبیعی عسل خام و روش درست نگهداری آن بدون آسیب به آنزیم‌ها.",
        publishedAt: "2026-10-28T08:00:00.000Z",
        coverImageUrl: "/images/tebahmadi/mountain-honey.jpg",
        tags: ["عسل طبیعی", "تغذیه سالم"],
        categories: [{ id: "bcat-1", name: "راهنمای دم‌آوری", slug: "brewing-guide", path: "brewing-guide" }],
        content:
            "<h2>رس بستن نشانه خلوص عسل خام است</h2><p>تبلور یا رس بستن عسل یک فرآیند کاملاً طبیعی به دلیل نسبت گلوکز به فروکتوز و وجود ذرات ریز گرده گل در عسل حرارت‌ندیده است.</p>",
    },
];

export function getPreviewSiteInfo() {
    return {
        ...DEFAULT_SITE_INFO,
        phone: BRAND.phone,
        email: "",
    };
}

export function getPreviewCategoriesAsTree() {
    return PREVIEW_CATEGORIES.map((cat) => ({
        _id: cat.id,
        name: cat.name,
        slug: cat.slug,
        path: cat.path,
        depth: cat.depth,
        parentId: cat.parentId,
        imageId: cat.imageId,
        mediaId: cat.mediaId,
        isActive: true,
        position: cat.position,
        ancestors: [],
    }));
}

export function getPreviewDiscountProducts() {
    const items = PREVIEW_PRODUCTS.filter((p) => (p.card.discountPercent ?? 0) > 0).map((p) => p.card);
    return { items, total: items.length };
}

export function getPreviewNewestProducts() {
    const items = [...PREVIEW_PRODUCTS]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((p) => p.card);
    return { items, total: items.length };
}

export function getPreviewPopularProducts() {
    const items = PREVIEW_PRODUCTS.filter((p) => p.isPopular).map((p) => p.card);
    return { items, total: items.length };
}

export function getPreviewStoreCategoryContext(slugSegments: string[]): StoreCategoryContext | null {
    const normalized = slugSegments.map((s) => s.trim()).filter(Boolean);
    const rootSlug = normalized[0];
    const match = PREVIEW_CATEGORIES.find((cat) => cat.slug === rootSlug || cat.path === normalized.join("/"));
    if (!match) return null;

    const filterAttributes: StoreFilterAttribute[] = [
        {
            key: "weight",
            label: "وزن و حجم",
            kind: "enum",
            options: [
                { value: "۱۰۰ گرم", label: "۱۰۰ گرم" },
                { value: "۱۵۰ گرم", label: "۱۵۰ گرم" },
                { value: "۲۰۰ گرم", label: "۲۰۰ گرم" },
                { value: "۵۰۰ گرم", label: "۵۰۰ گرم" },
                { value: "۶۰ میلی‌لیتر", label: "۶۰ میلی‌لیتر" },
            ],
        },
    ];

    return {
        root: {
            ...match,
            seoTitle: `${match.name} | ${BRAND.name}`,
            seoDescription: match.description,
        },
        active: match,
        breadcrumbs: [match],
        children: [],
        productTypes: [{ id: `pt-${match.slug}`, name: match.name, attributes: filterAttributes }],
        filterAttributes,
        productTypeIds: [`pt-${match.slug}`],
    };
}

export function queryPreviewStoreProducts(params: {
    categoryId?: string;
    categorySlug?: string;
    q?: string;
    sort?: string;
    inStockOnly?: boolean;
    discountOnly?: boolean;
    minPrice?: number;
    maxPrice?: number;
    page?: number;
    pageSize?: number;
}) {
    let list = [...PREVIEW_PRODUCTS];

    if (params.categoryId) {
        list = list.filter((item) => item.categoryId === params.categoryId);
    }
    if (params.categorySlug) {
        list = list.filter((item) => item.categorySlug === params.categorySlug);
    }
    if (params.q && params.q.trim()) {
        const needle = params.q.trim().toLowerCase();
        list = list.filter(
            (item) =>
                item.card.title.toLowerCase().includes(needle) ||
                item.categoryName.toLowerCase().includes(needle) ||
                (item.card.variantSubtitle ?? "").toLowerCase().includes(needle),
        );
    }
    if (params.inStockOnly) {
        list = list.filter((item) => item.card.inStock);
    }
    if (params.discountOnly) {
        list = list.filter((item) => (item.card.discountPercent ?? 0) > 0);
    }
    if (typeof params.minPrice === "number" && Number.isFinite(params.minPrice)) {
        list = list.filter((item) => item.card.finalPrice >= params.minPrice!);
    }
    if (typeof params.maxPrice === "number" && Number.isFinite(params.maxPrice)) {
        list = list.filter((item) => item.card.finalPrice <= params.maxPrice!);
    }

    if (params.sort === "cheapest") {
        list.sort((a, b) => a.card.finalPrice - b.card.finalPrice);
    } else if (params.sort === "expensive") {
        list.sort((a, b) => b.card.finalPrice - a.card.finalPrice);
    } else {
        list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }

    const pageSize = params.pageSize ?? 24;
    const total = list.length;
    const pages = Math.max(1, Math.ceil(total / pageSize));
    const currentPage = Math.min(Math.max(1, params.page ?? 1), pages);
    const start = (currentPage - 1) * pageSize;
    const products = list.slice(start, start + pageSize).map((item) => item.card);

    return { products, total, pages, currentPage, pageSize };
}

export function getPreviewProductDetail(slug: string): ProductDetailData | null {
    const found = PREVIEW_PRODUCTS.find((item) => item.detail.slug === slug);
    return found ? found.detail : null;
}

export function getPreviewSimilarProducts(slug: string): ProductCardProps[] {
    return PREVIEW_PRODUCTS.filter((item) => item.detail.slug !== slug)
        .slice(0, 4)
        .map((item) => item.card);
}

export function getPreviewBlogIndex(searchParams: Record<string, string | string[] | undefined>): BlogIndexData {
    const qRaw = Array.isArray(searchParams.q) ? searchParams.q[0] : searchParams.q;
    const categoryRaw = Array.isArray(searchParams.category) ? searchParams.category[0] : searchParams.category;
    const searchTerm = (qRaw ?? "").trim();
    const categoryParam = (categoryRaw ?? "").trim();

    const selectedCategory =
        PREVIEW_BLOG_CATEGORIES.find((cat) => cat.path === categoryParam || cat.slug === categoryParam || cat.id === categoryParam) ??
        null;

    let posts = PREVIEW_BLOG_POSTS.map(({ content: _unused, ...rest }) => rest);
    if (selectedCategory) {
        posts = posts.filter((post) => post.categories.some((c) => c.id === selectedCategory.id));
    }
    if (searchTerm) {
        const needle = searchTerm.toLowerCase();
        posts = posts.filter(
            (post) =>
                post.title.toLowerCase().includes(needle) ||
                (post.excerpt ?? "").toLowerCase().includes(needle),
        );
    }

    return {
        searchTerm,
        page: 1,
        pages: 1,
        total: posts.length,
        pageSize: 9,
        posts,
        categories: PREVIEW_BLOG_CATEGORIES,
        selectedCategory,
        allPostsCount: PREVIEW_BLOG_POSTS.length,
    };
}

export function getPreviewBlogPost(slug: string): BlogPostData | null {
    const found = PREVIEW_BLOG_POSTS.find((item) => item.slug === slug);
    if (!found) return null;
    const related = PREVIEW_BLOG_POSTS.filter((item) => item.slug !== slug)
        .slice(0, 3)
        .map((item) => ({
            id: item.id,
            slug: item.slug,
            title: item.title,
            coverImageUrl: item.coverImageUrl,
            publishedAt: item.publishedAt,
        }));
    return {
        post: {
            id: found.id,
            slug: found.slug,
            title: found.title,
            excerpt: found.excerpt,
            content: found.content,
            publishedAt: found.publishedAt,
            updatedAt: found.publishedAt,
            coverImageUrl: found.coverImageUrl,
            tags: found.tags,
            categories: found.categories,
            seo: {
                title: `${found.title} | ${BRAND.name}`,
                description: found.excerpt ?? BRAND.description,
            },
        },
        related,
    };
}
