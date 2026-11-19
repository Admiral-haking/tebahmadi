import DashboardAdminView from '@/views/admin/dashboard';
import { buildAdminMetadata } from '@/lib/admin-metadata';

const PAGE_TITLE = 'داشبورد مدیریت فروشگاه';

export async function generateMetadata() {
  return buildAdminMetadata(PAGE_TITLE);
}

export default function Page() {
  return <DashboardAdminView />;
}
