import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { loadPageBySlug } from "@/lib/cache";
import { generatePageMetadata } from "@/seo/services/metadataGenerator";
import PageView from "@/views/page";

const FALLBACK_PAGES: Record<string, { title: string; content: string; description: string }> = {
  about: {
    title: "درباره طب احمدی",
    description: "طب احمدی؛ انتخابی مطمئن برای محصولات طبیعی و گیاهان دارویی.",
    content: "<h2>اصالت طبیعت، عیار تندرستی</h2><p>طب احمدی با انتخاب دقیق گیاهان دارویی، دمنوش‌ها، عسل و فرآورده‌های طبیعی، اطلاعات روشن و تجربه‌ای مطمئن برای خرید آگاهانه فراهم می‌کند.</p><p>اصالت محصول، نگهداری درست و ارسال ایمن، پایهٔ تجربه‌ای است که برای مشتریان خود می‌سازیم.</p>",
  },
  contact: {
    title: "تماس با طب احمدی",
    description: "راه‌های ارتباط با فروشگاه طب احمدی.",
    content: "<h2>در ارتباط بمانید</h2><p>برای پیگیری سفارش، پرسش درباره محصولات یا دریافت راهنمایی با ما در تماس باشید.</p><p><strong>شماره تماس:</strong> <a href=\"tel:09354395264\">۰۹۳۵۴۳۹۵۲۶۴</a></p><p>پاسخ‌گویی در روزهای کاری انجام می‌شود.</p>",
  },
  terms: {
    title: "شرایط خرید",
    description: "شرایط خرید و ارسال سفارش از طب احمدی.",
    content: "<h2>شرایط خرید و ارسال</h2><p>قیمت و موجودی نهایی هنگام ثبت سفارش از اطلاعات معتبر فروشگاه محاسبه می‌شود. ارسال سفارش‌ها با پست پیشتاز انجام می‌شود و اطلاعات گیرنده باید کامل و دقیق باشد.</p><ul><li>نام و نام خانوادگی، شماره موبایل و کد پستی الزامی است.</li><li>تغییر وضعیت سفارش از طریق حساب کاربری و پیام‌های اطلاع‌رسانی انجام می‌شود.</li></ul>",
  },
  privacy: {
    title: "حریم خصوصی",
    description: "سیاست حریم خصوصی طب احمدی.",
    content: "<h2>حریم خصوصی مشتریان</h2><p>اطلاعات تماس و نشانی فقط برای احراز هویت، پردازش سفارش و ارسال استفاده می‌شود و بدون مجوز قانونی در اختیار شخص دیگری قرار نمی‌گیرد.</p>",
  },
  licenses: {
    title: "مجوزها و اعتماد",
    description: "اطلاعات مجوزها و اعتماد فروشگاه طب احمدی.",
    content: "<h2>اعتماد و پاسخ‌گویی</h2><p>اطلاعات مجوزها و نشان‌های اعتماد فروشگاه در این صفحه و تنظیمات رسمی سایت نگهداری می‌شود. برای بررسی یا پرسش درباره آن‌ها با پشتیبانی تماس بگیرید.</p>",
  },
};

function fallbackPage(slug: string) {
  const value = FALLBACK_PAGES[slug];
  if (!value) return null;
  return { ...value, seo: { title: value.title, description: value.description, jsonLd: undefined }, publishedAt: new Date(), updatedAt: new Date(), createdAt: new Date() };
}

type PageRouteParams = {
  slug: string;
};

type PageRouteProps = {
  params: Promise<PageRouteParams>;
};

function stripHtml(value: string | null | undefined): string {
  if (!value) return "";
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function createExcerpt(html: string | null | undefined, limit = 160): string | undefined {
  const text = stripHtml(html);
  if (!text) return undefined;
  if (text.length <= limit) return text;
  return `${text.slice(0, limit - 1)}…`;
}

export async function generateMetadata({ params }: Pick<PageRouteProps, "params">): Promise<Metadata> {
  const { slug } = await params;
  if (!slug) {
    notFound();
  }

  const page = (await loadPageBySlug(slug)) ?? fallbackPage(slug);
  if (!page) {
    notFound();
  }

  const fallbackDescription = page.seo?.description ?? createExcerpt(page.content ?? "");

  const { metadata } = await generatePageMetadata({
    slug: `/page/${slug}`,
    entitySeo: (page.seo ?? undefined) as any,
    defaults: {
      title: page.title,
      description: fallbackDescription,
    },
  });

  return metadata;
}

export default async function Page({ params }: PageRouteProps) {
  const { slug } = await params;
  if (!slug) {
    notFound();
  }

  const page = (await loadPageBySlug(slug)) ?? fallbackPage(slug);
  if (!page) {
    notFound();
  }

  return <PageView page={page} jsonLd={page.seo?.jsonLd} />;
}
