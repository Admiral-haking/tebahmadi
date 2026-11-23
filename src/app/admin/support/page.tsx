import { buildAdminMetadata } from '@/lib/admin-metadata';
import SupportAdminView from '@/views/admin/support';

const PAGE_TITLE = 'تیکت‌های پشتیبانی';

export async function generateMetadata() {
  return buildAdminMetadata(PAGE_TITLE);
}

export default function Page() {
  return <SupportAdminView />;
}
