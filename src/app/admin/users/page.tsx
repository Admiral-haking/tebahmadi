import { Container } from '@mui/material';

import UsersAdminView from '@/views/admin/users';
import { buildAdminMetadata } from '@/lib/admin-metadata';

const PAGE_TITLE = 'کاربران';

type SearchParams = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value ?? undefined;
}

function toPageNumber(value: string | undefined): number {
  if (!value) return 1;
  const next = Number(value);
  return Number.isNaN(next) ? 1 : next;
}

export async function generateMetadata() {
  return buildAdminMetadata(PAGE_TITLE);
}

export default async function Page({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const resolvedSearchParams = await searchParams;
  const page = toPageNumber(firstValue(resolvedSearchParams?.page));
  const q = firstValue(resolvedSearchParams?.q) ?? '';

  return (
    <Container maxWidth="lg" sx={{ py: 0 }}>
      <UsersAdminView page={page} q={q} />
    </Container>
  );
}
