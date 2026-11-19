import ProductTypesAdminView from '@/views/admin/catalog/product-types';
import { buildAdminMetadata } from '@/lib/admin-metadata';

const PAGE_TITLE = 'انواع محصول';

export async function generateMetadata() {
  return buildAdminMetadata(PAGE_TITLE);
}

export default function Page() {
  return <ProductTypesAdminView />;
}
