import { Container } from '@mui/material';
import MediaAdminView from '@/views/admin/media';
import { buildAdminMetadata } from '@/lib/admin-metadata';

const PAGE_TITLE = 'گالری رسانه';

type SearchParams = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value ?? undefined;
}

function toNumber(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

export async function generateMetadata() {
  return buildAdminMetadata(PAGE_TITLE);
}

export default async function Page({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const resolvedSearchParams = await searchParams;
  const pageParam = firstValue(resolvedSearchParams?.page);
  const scope = firstValue(resolvedSearchParams?.scope);
  const kind = firstValue(resolvedSearchParams?.kind);
  const owner = firstValue(resolvedSearchParams?.owner);
  const q = firstValue(resolvedSearchParams?.q);
  const pageNumber = toNumber(pageParam) ?? 1;

  return (
    <Container maxWidth="lg" sx={{ py: 0 }}>
      <MediaAdminView
        page={pageNumber}
        q={q}
        scope={scope}
        kind={kind}
        owner={owner}
      />
    </Container>
  );
}
