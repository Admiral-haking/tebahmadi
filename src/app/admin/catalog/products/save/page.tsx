import { Container, NoSsr } from '@mui/material';
import ProductSave from '@/views/admin/catalog/products/save';
import { buildAdminMetadata } from '@/lib/admin-metadata';

const CREATE_TITLE = 'ایجاد محصول جدید';
const EDIT_TITLE = 'ویرایش محصول';

type SearchParams = Record<string, string | string[] | undefined>;

function resolveParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? '';
  }
  return value ?? '';
}

export async function generateMetadata({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const id = resolveParam((await searchParams)?.id);
  const title = id ? EDIT_TITLE : CREATE_TITLE;
  return buildAdminMetadata(title);
}

export default function Page() {
  return (
    <Container maxWidth="lg">
      <NoSsr>
        <ProductSave />
      </NoSsr>
    </Container>
  );
}
