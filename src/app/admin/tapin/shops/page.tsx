import { buildAdminMetadata } from '@/lib/admin-metadata';
import TapinShops from './tapin-shops';

export async function generateMetadata() {
  return buildAdminMetadata('فروشگاه‌های تاپین');
}

export default function Page() {
  return <TapinShops />;
}
