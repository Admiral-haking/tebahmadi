import { revalidatePath, revalidateTag, TAGS } from '@/lib/cache';
import { SiteInfoModel, type SiteInfoDocument } from '@/settings/models/SiteInfo';
import { SiteConfigModel, type SiteConfigDocument } from '@/settings/models/SiteConfig';
import { connectMongoose, isMongoConfigured } from '@/lib/mongoose';
import { DEFAULT_SITE_INFO } from '@/config/brand';

const SITE_REVALIDATE_PATHS = ['/', '/blog', '/store'];
const CONFIG_REVALIDATE_PATHS = ['/', '/store', '/payments/verify'];

function cleanupPayload<T extends Record<string, unknown>>(payload: T): T {
  const update = { ...payload } as T;
  Object.keys(update).forEach((key) => {
    if (typeof update[key] === 'undefined') {
      delete update[key];
    }
  });
  return update;
}

async function revalidateSiteInfoPaths(): Promise<void> {
  await Promise.all([
    revalidateTag(TAGS.SITE_INFO),
    revalidateTag(TAGS.SETTINGS),
    ...SITE_REVALIDATE_PATHS.map((path) => revalidatePath(path)),
  ]);
}

async function revalidateSiteConfigPaths(): Promise<void> {
  await Promise.all([
    revalidateTag(TAGS.SITE_CONFIG),
    revalidateTag(TAGS.SETTINGS),
    ...CONFIG_REVALIDATE_PATHS.map((path) => revalidatePath(path)),
  ]);
}

export async function getSiteInfo() {
  if (!isMongoConfigured()) {
    return DEFAULT_SITE_INFO as unknown as SiteInfoDocument;
  }
  try {
    await connectMongoose();
    return (await SiteInfoModel.findOne().lean<SiteInfoDocument | null>())
      ?? (DEFAULT_SITE_INFO as unknown as SiteInfoDocument);
  } catch (error) {
    console.warn('getSiteInfo failed; using default site info', error);
    return DEFAULT_SITE_INFO as unknown as SiteInfoDocument;
  }
}

export async function updateSiteInfo(payload: Partial<SiteInfoDocument>) {
  const update = cleanupPayload({ ...payload });
  const { _id: _unusedId, ...rest } = update;
  void _unusedId;
  const doc = await SiteInfoModel.findOneAndUpdate({}, { $set: rest }, { new: true, upsert: true }).lean();
  await revalidateSiteInfoPaths();
  return doc;
}

export async function getSiteConfig() {
  if (!isMongoConfigured()) {
    return null;
  }
  try {
    await connectMongoose();
    return await SiteConfigModel.findOne().lean<SiteConfigDocument | null>();
  } catch (error) {
    console.warn('getSiteConfig failed; returning null', error);
    return null;
  }
}

export async function updateSiteConfig(payload: Partial<SiteConfigDocument>) {
  const update = cleanupPayload({ ...payload });
  const { _id: _unusedId, ...rest } = update;
  void _unusedId;
  const doc = await SiteConfigModel.findOneAndUpdate({}, { $set: rest }, { new: true, upsert: true }).lean();
  await revalidateSiteConfigPaths();
  return doc;
}

export async function isConfigured() {
  await connectMongoose()
  const config = await SiteConfigModel.findOne().lean<SiteConfigDocument | null>();
  if (!config) {
    return { ok: false, missingKeys: [] as string[] };
  }

  const required = config.requiredKeys ?? [];
  const values = (config.values ?? {}) as Record<string, unknown>;
  const missingKeys = required.filter((key) => typeof values[key] === 'undefined' || values[key] === null || values[key] === '');

  const ok = config.isOnboardingComplete && missingKeys.length === 0;
  return { ok, missingKeys };
}

export async function assertConfiguredOrThrow() {
  const { ok, missingKeys } = await isConfigured();
  if (!ok) {
    const error: Error & { code?: string; missingKeys?: string[] } = new Error('SETUP_REQUIRED');
    error.code = 'SETUP_REQUIRED';
    error.missingKeys = missingKeys;
    throw error;
  }
}
