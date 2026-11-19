import { Types } from 'mongoose';
import { revalidatePath, revalidateTag, TAGS } from '@/lib/cache';
import { SlideModel, type SlideDocument } from '@/content/models/Slide';

export type SlideDTO = {
  id: string;
  mediaId: string;
  mediaDesktopId: string;
  mediaMobileId: string;
  href: string;
  createdAt: string;
  updatedAt: string;
};

type SlideSource = {
  _id: Types.ObjectId | string;
  mediaId?: Types.ObjectId | string | null;
  mediaDesktopId?: Types.ObjectId | string | null;
  mediaMobileId?: Types.ObjectId | string | null;
  href: string;
  createdAt: Date | string;
  updatedAt: Date | string;
};

function toStringObjectId(value: Types.ObjectId | string | null | undefined): string | null {
  if (!value) return null;
  return typeof value === 'string' ? value : value.toString();
}

function mapSlide(doc: SlideSource): SlideDTO {
  const id = typeof doc._id === 'string' ? doc._id : doc._id.toString();
  const legacyMediaId = toStringObjectId(doc.mediaId);
  const mediaDesktopId = toStringObjectId(doc.mediaDesktopId) ?? legacyMediaId ?? '';
  const mediaMobileId = toStringObjectId(doc.mediaMobileId) ?? mediaDesktopId;
  const mediaId = legacyMediaId ?? mediaDesktopId;

  const createdAt =
    doc.createdAt instanceof Date ? doc.createdAt.toISOString() : new Date(doc.createdAt).toISOString();
  const updatedAt =
    doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : new Date(doc.updatedAt).toISOString();

  return {
    id,
    mediaId,
    mediaDesktopId,
    mediaMobileId,
    href: doc.href,
    createdAt,
    updatedAt,
  };
}

export async function createSlide(input: {
  mediaDesktopId: string;
  mediaMobileId?: string;
  href: string;
}): Promise<SlideDTO> {
  const desktopObjectId = new Types.ObjectId(input.mediaDesktopId);
  const mobileObjectId = input.mediaMobileId
    ? new Types.ObjectId(input.mediaMobileId)
    : desktopObjectId;

  const doc = await SlideModel.create({
    mediaId: desktopObjectId,
    mediaDesktopId: desktopObjectId,
    mediaMobileId: mobileObjectId,
    href: input.href.trim(),
  });

  await revalidateTag(TAGS.SLIDES);
  await revalidatePath('/');

  return mapSlide(doc.toObject() as SlideDocument);
}

export async function listSlides(): Promise<SlideDTO[]> {
  const slides = await SlideModel.find({})
    .sort({ createdAt: -1 })
    .lean<SlideDocument[]>();

  return slides.map((slide) =>
    mapSlide({
      _id: slide._id,
      mediaId: slide.mediaId,
      mediaDesktopId: slide.mediaDesktopId,
      mediaMobileId: slide.mediaMobileId,
      href: slide.href,
      createdAt: slide.createdAt,
      updatedAt: slide.updatedAt,
    }),
  );
}

export async function deleteSlide(id: string): Promise<boolean> {
  const deleted = await SlideModel.findByIdAndDelete(id).lean();
  if (!deleted) {
    return false;
  }

  await revalidateTag(TAGS.SLIDES);
  await revalidatePath('/');
  return true;
}
