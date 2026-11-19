import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Types } from 'mongoose';
import { connectMongoose } from '@/lib/mongoose';
import { MetaOverrideModel, type MetaOverrideDocument } from '@/seo/models/MetaOverride';
import { zRouteSlug, zSeo } from '@/lib/z';
import { requirePermission } from '@/lib/auth';

const createSchema = z.object({
  slug: zRouteSlug,
  seo: zSeo.optional(),
});

type MetaSeo = NonNullable<MetaOverrideDocument['seo']>;

function mapSeo(input?: z.infer<typeof zSeo>): MetaSeo | undefined {
  if (!input) return undefined;
  const { ogImageId, ...rest } = input;
  const seo: MetaSeo = {
    ...rest,
    ...(ogImageId ? { ogImageId: new Types.ObjectId(ogImageId) } : {}),
  };
  return seo;
}

export async function GET() {
  await connectMongoose();
  const overrides = await MetaOverrideModel.find().lean();
  return NextResponse.json({ data: overrides });
}

export async function POST(request: NextRequest) {
  await connectMongoose();
  await requirePermission(request, 'catalog:publish');
  try {
    const body = await request.json();
    const parsed = createSchema.parse(body);
    const override = await MetaOverrideModel.findOneAndUpdate(
      { slug: parsed.slug },
      { $set: { seo: mapSeo(parsed.seo) } },
      { new: true, upsert: true }
    ).lean();
    return NextResponse.json({ data: override }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    console.error('Failed to upsert meta override', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
