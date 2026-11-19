import { Container } from '@mui/material';
import ProductsAdminView from '@/views/admin/catalog/products';
import { buildAdminMetadata } from '@/lib/admin-metadata';

const PAGE_TITLE = 'مدیریت محصولات';

export async function generateMetadata() {
  return buildAdminMetadata(PAGE_TITLE);
}

export default function Page() {
  return (
    <Container maxWidth="lg">
      <ProductsAdminView />
    </Container>
  );
}
