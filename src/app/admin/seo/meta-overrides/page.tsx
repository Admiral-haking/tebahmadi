import { Container } from '@mui/material';
import MetaOverridesAdminView from '@/views/admin/seo/meta-overrides';
import { buildAdminMetadata } from '@/lib/admin-metadata';

const PAGE_TITLE = 'تنظیمات سئو - Meta Overrides';

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
  const resolvedSearchParams = await searchParams;
  const q = resolveQueryParam(resolvedSearchParams?.q);

  return (
    <Container maxWidth="lg" sx={{ py: 0 }}>
      <MetaOverridesAdminView q={q} />
    </Container>
  );
}
