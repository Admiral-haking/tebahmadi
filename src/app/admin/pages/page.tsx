import PagesAdminView from '@/views/admin/pages';
import { buildAdminMetadata } from '@/lib/admin-metadata';

const PAGE_TITLE = 'مدیریت صفحات';

export async function generateMetadata() {
  return buildAdminMetadata(PAGE_TITLE);
}

export default function AdminPagesPage() {
  return <PagesAdminView />;
}
