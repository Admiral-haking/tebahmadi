import { buildAdminMetadata } from '@/lib/admin-metadata';
import TapinDashboard from './tapin-dashboard';

export async function generateMetadata() {
  return buildAdminMetadata('مدیریت تاپین');
}

export default function Page() {
  return <TapinDashboard />;
}
