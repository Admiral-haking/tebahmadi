import { headers } from 'next/headers';

import { connectMongoose } from '@/lib/mongoose';
import { TransportModel } from '@/orders/models/Transport';
import ToJson from '@/utils/toJson';
import TransportSaveView from '@/views/admin/transport/save';
import { buildAdminMetadata } from '@/lib/admin-metadata';

const CREATE_TITLE = 'روش حمل و نقل جدید';
const EDIT_TITLE = 'ویرایش روش حمل و نقل';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function resolveTransportId(paramsPromise: SearchParams): Promise<string | undefined> {
  const params = await paramsPromise;
  const idParam = params?.id;
  return Array.isArray(idParam) ? idParam[0] : idParam ?? undefined;
}

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }) {
  const id = await resolveTransportId(searchParams);
  const title = id ? EDIT_TITLE : CREATE_TITLE;
  return buildAdminMetadata(title);
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  headers();
  const id = await resolveTransportId(searchParams);

  await connectMongoose();

  const carrier = id ? await TransportModel.findById(id).lean() : null;

  const formatted = carrier
    ? {
        id: carrier._id.toString(),
        name: carrier.name,
        isActive: carrier.isActive ?? true,
        pricingRows: carrier.pricingRows ?? [],
      }
    : null;

  return <TransportSaveView defaultValues={formatted ? ToJson(formatted) : null} />;
}
