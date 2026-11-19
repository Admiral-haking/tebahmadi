import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Types } from 'mongoose';
import { connectMongoose } from '@/lib/mongoose';
import { MetaOverrideModel, type MetaOverrideDocument } from '@/seo/models/MetaOverride';
import { zObjectIdString, zRouteSlug, zSeo } from '@/lib/z';

const paramsSchema = z.object({ id: zObjectIdString });

const updateSchema = z.object({
  slug: zRouteSlug.optional(),
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

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const params = await context.params;
  await connectMongoose();
  const parse = paramsSchema.safeParse(params);
  if (!parse.success) {
    return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });
  }
  const override = await MetaOverrideModel.findById(parse.data.id).lean();
  if (!override) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  return NextResponse.json({ data: override });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const params = await context.params;
  await connectMongoose();
  const parseParams = paramsSchema.safeParse(params);
  if (!parseParams.success) {
    return NextResponse.json({ error: parseParams.error.flatten() }, { status: 400 });
  }
  try {
    const body = await request.json();
    const parsed = updateSchema.parse(body);
    const update: Record<string, unknown> = {};
    if (typeof parsed.slug === 'string') update.slug = parsed.slug;
    if (typeof parsed.seo !== 'undefined') update.seo = mapSeo(parsed.seo);

    const override = await MetaOverrideModel.findByIdAndUpdate(parseParams.data.id, update, {
      new: true,
    }).lean();
    if (!override) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    return NextResponse.json({ data: override });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    const mongoError = error as { code?: number };
    if (mongoError?.code === 11000) {
      return NextResponse.json({ error: 'duplicate_slug' }, { status: 409 });
    }
    console.error('Failed to update meta override', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const params = await context.params;
  await connectMongoose();
  const parse = paramsSchema.safeParse(params);
  if (!parse.success) {
    return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });
  }
  await MetaOverrideModel.findByIdAndDelete(parse.data.id).exec();
  return NextResponse.json({ ok: true });
}
