import { buildAdminMetadata } from '@/lib/admin-metadata';
import TapinHistory from './tapin-history';

export async function generateMetadata() {
  return buildAdminMetadata('تاریخچه تاپین');
}

export default function Page() {
  return <TapinHistory />;
}
