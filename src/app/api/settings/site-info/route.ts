import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Types } from 'mongoose';
import { connectMongoose } from '@/lib/mongoose';
import { getSiteInfo, updateSiteInfo } from '@/settings/services/settingsService';
import type { SiteInfoDocument } from '@/settings/models/SiteInfo';
import { zStringNonEmpty } from '@/lib/z';
import { requirePermission } from '@/lib/auth';
import { sitePagesSchema } from '@/settings/site-pages';

const addressSchema = z.object({
  label: z.string().optional(),
  address: z.string().min(1),
});

const phoneSchema = z.object({
  label: z.string().optional(),
  number: z.string().min(3),
});

const socialSchema = z.object({
  platform: z.string().min(1),
  url: z.string(),
});

const supportSchema = z.object({
  title: z.string().trim().max(160).optional(),
  description: z.string().trim().max(500).optional(),
  hours: z.string().trim().max(160).optional(),
  responseTime: z.string().trim().max(160).optional(),
  ticketEnabled: z.boolean().optional(),
});

const objectIdString = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, 'شناسه نامعتبر است');

const logoSchema = z.object({
  originalId: objectIdString,
  mobileId: objectIdString,
  thumbId: objectIdString,
  groupId: objectIdString,
});

const updateSchema = z.object({
  appName: zStringNonEmpty,
  description: z.string().optional(),
  addresses: z.array(addressSchema).optional(),
  bio: z.string().optional(),
  phones: z.array(phoneSchema).optional(),
  socials: z.array(socialSchema).optional(),
  contentPages: sitePagesSchema.partial().optional(),
  support: supportSchema.optional(),
  customData: z.record(z.string(), z.unknown()).optional(),
  logo: z.union([logoSchema, z.null()]).optional(),
});

export async function GET() {
  await connectMongoose();
  const info = await getSiteInfo();
  return NextResponse.json({ data: info });
}

export async function PATCH(request: NextRequest) {
  await connectMongoose();
  await requirePermission(request, 'users:write');
  try {
    const body = await request.json();
    const parsed = updateSchema.parse(body);

    const { logo, ...rest } = parsed;

    let logoPayload: SiteInfoDocument['logo'] | null | undefined;
    if (logo === null) {
      logoPayload = null;
    } else if (logo) {
      logoPayload = {
        originalId: new Types.ObjectId(logo.originalId),
        mobileId: new Types.ObjectId(logo.mobileId),
        thumbId: new Types.ObjectId(logo.thumbId),
        groupId: new Types.ObjectId(logo.groupId),
      };
    }

    const info = await updateSiteInfo({ ...(rest as Partial<SiteInfoDocument>), logo: logoPayload });
    return NextResponse.json({ data: info });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    console.error('Failed to update site info', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
