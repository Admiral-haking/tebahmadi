import { headers } from 'next/headers';

import { connectMongoose } from '@/lib/mongoose';
import { OfferModel } from '@/orders/models/Offer';
import ToJson from '@/utils/toJson';
import OfferSaveView from '@/views/admin/offers/save';
import { buildAdminMetadata } from '@/lib/admin-metadata';

const CREATE_TITLE = 'کوپن جدید';
const EDIT_TITLE = 'ویرایش کوپن';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function resolveOfferId(paramsPromise: SearchParams): Promise<string | undefined> {
  const params = await paramsPromise;
  const idParam = params?.id;
  return Array.isArray(idParam) ? idParam[0] : idParam ?? undefined;
}

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }) {
  const id = await resolveOfferId(searchParams);
  const title = id ? EDIT_TITLE : CREATE_TITLE;
  return buildAdminMetadata(title);
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  headers();
  const id = await resolveOfferId(searchParams);

  await connectMongoose();

  const offer = id ? await OfferModel.findById(id).lean() : null;

  const formatted = offer
    ? {
        id: offer._id.toString(),
        code: offer.code,
        type: offer.type,
        amount: offer.amount ?? undefined,
        startsAt: offer.startsAt ? offer.startsAt.toISOString().slice(0, 16) : undefined,
        endsAt: offer.endsAt ? offer.endsAt.toISOString().slice(0, 16) : undefined,
        usageLimitTotal: offer.usageLimitTotal ?? undefined,
        usageLimitPerUser: offer.usageLimitPerUser ?? undefined,
        minOrderSubtotal: offer.minOrderSubtotal ?? undefined,
        isActive: offer.isActive ?? true,
      }
    : null;

  return <OfferSaveView defaultValues={formatted ? ToJson(formatted) : null} />;
}
