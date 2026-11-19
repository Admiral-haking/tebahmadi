import { headers } from 'next/headers';

import { connectMongoose } from '@/lib/mongoose';
import { MetaOverrideModel } from '@/seo/models/MetaOverride';
import ToJson from '@/utils/toJson';
import MetaOverrideSaveView from '@/views/admin/seo/meta-overrides/save';
import { buildAdminMetadata } from '@/lib/admin-metadata';

const CREATE_TITLE = 'ثبت Meta Override جدید';
const EDIT_TITLE = 'ویرایش Meta Override';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function resolveOverrideId(paramsPromise: SearchParams): Promise<string | undefined> {
  const params = await paramsPromise;
  const idParam = params?.id;
  return Array.isArray(idParam) ? idParam[0] : idParam ?? undefined;
}

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }) {
  const id = await resolveOverrideId(searchParams);
  const title = id ? EDIT_TITLE : CREATE_TITLE;
  return buildAdminMetadata(title);
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  headers();
  const id = await resolveOverrideId(searchParams);

  await connectMongoose();

  const override = id ? await MetaOverrideModel.findById(id).lean() : null;

  const formatted = override
    ? {
        id: override._id.toString(),
        slug: override.slug,
        seo: override.seo
          ? {
              title: override.seo.title ?? undefined,
              description: override.seo.description ?? undefined,
              canonical: override.seo.canonical ?? undefined,
              noindex: override.seo.noindex ?? undefined,
              ogImageId: override.seo.ogImageId ? override.seo.ogImageId.toString() : undefined,
              jsonLd: override.seo.jsonLd ?? undefined,
            }
          : undefined,
      }
    : null;

  return <MetaOverrideSaveView defaultValues={formatted ? ToJson(formatted) : null} />;
}
