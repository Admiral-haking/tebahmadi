import { buildAdminMetadata } from '@/lib/admin-metadata';
import { VariantsView } from '@/views/admin/catalog/variants';

const PAGE_TITLE = 'مدیریت تنوع';

export async function generateMetadata() {
  return buildAdminMetadata(PAGE_TITLE);
}

export default function Page() {
  return (
    <VariantsView />
  );
}
