import { loadSiteInfo } from '@/lib/cache';
import { BRAND } from '@/config/brand';
import SupportPageClient, { type SupportPageConfig } from './support-page-client';

export default async function SupportPage() {
  const info = await loadSiteInfo();
  const config: SupportPageConfig = {
    appName: info?.appName ?? BRAND.name,
    phones: (info?.phones ?? []).filter((phone) => phone.number?.trim()).map((phone) => ({
      label: phone.label ?? 'تماس',
      number: phone.number,
    })),
    socials: (info?.socials ?? []).filter((social) => social.platform && social.url).map((social) => ({
      platform: social.platform,
      url: social.url,
    })),
    addresses: (info?.addresses ?? []).map((address) => ({
      label: address.label ?? '',
      address: address.address,
    })),
    support: {
      title: info?.support?.title ?? 'تماس با ما',
      description: info?.support?.description ?? 'اگر پرسشی دارید، درخواست خود را ثبت کنید تا پیگیری شود.',
      hours: info?.support?.hours ?? '',
      responseTime: info?.support?.responseTime ?? 'پاسخ‌گویی در روزهای کاری انجام می‌شود.',
      ticketEnabled: info?.support?.ticketEnabled !== false,
    },
  };

  return <SupportPageClient config={config} />;
}
