import PagesSaveView from '@/views/admin/pages/save';
import { buildAdminMetadata } from '@/lib/admin-metadata';

const CREATE_TITLE = 'ایجاد صفحه جدید';
const EDIT_TITLE = 'ویرایش صفحه';

type SearchParams = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value ?? undefined;
}

export async function generateMetadata({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const id = firstValue((await searchParams)?.id);
  const title = id ? EDIT_TITLE : CREATE_TITLE;
  return buildAdminMetadata(title);
}

export default async function Page({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const id = firstValue((await searchParams)?.id) ?? null;
  return <PagesSaveView pageId={id} />;
}
