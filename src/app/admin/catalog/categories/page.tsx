import { Container } from '@mui/material';
import CategoriesAdminView from '@/views/admin/catalog/categories';
import { buildAdminMetadata } from '@/lib/admin-metadata';

const PAGE_TITLE = 'مدیریت دسته‌بندی‌ها';

type SearchParams = Record<string, string | string[] | undefined>;

function resolveQueryParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? '';
  }
  return value ?? '';
}

export async function generateMetadata() {
  return buildAdminMetadata(PAGE_TITLE);
}

export default async function Page({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const q = resolveQueryParam((await searchParams)?.q);

  return (
    <Container maxWidth="lg" sx={{ py: 0 }}>
      <CategoriesAdminView q={q} />
    </Container>
  );
}
