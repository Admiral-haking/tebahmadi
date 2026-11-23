export const BRAND = {
  name: 'طب احمدی',
  title: 'طب احمدی | محصولات طبیعی و گیاهان دارویی',
  description:
    'طب احمدی؛ فروشگاه محصولات طبیعی، گیاهان دارویی و فرآورده‌های ارگانیک با اطلاعات روشن و ارسال پست پیشتاز.',
  bio:
    'طب احمدی با انتخاب دقیق محصولات طبیعی و گیاهان دارویی، اطلاعات روشن و تجربه‌ای مطمئن برای خرید آگاهانه فراهم می‌کند.',
  url: 'https://tebahmadi.ir',
  locale: 'fa_IR',
} as const;

/** Used while site settings are empty so generic source-project copy never reaches customers. */
export const DEFAULT_SITE_INFO = {
  appName: BRAND.name,
  description: BRAND.description,
  bio: BRAND.bio,
  addresses: [],
  phones: [],
  socials: [],
  support: {
    ticketEnabled: true,
    responseTime: 'پاسخ‌گویی در روزهای کاری انجام می‌شود.',
  },
  customData: {
    enamad: 'IA189lcBdWPErJe12MxFu0ux2Z2Yp2IZ',
    enamadLink: 'https://trustseal.enamad.ir/?id=8716799&Code=IA189lcBdWPErJe12MxFu0ux2Z2Yp2IZ',
  },
};
