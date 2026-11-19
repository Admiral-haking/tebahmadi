import mongoose, { type ClientSession } from 'mongoose';
import { OfferModel, type OfferDocument } from '@/orders/models/Offer';
import { OfferRedemptionModel, type OfferRedemptionDocument } from '@/orders/models/OfferRedemption';
import { clampNonNegative, floorInt } from '@/lib/calc';
import { supportsMongoTransactions } from '@/lib/mongo';

export type OfferType = 'percentage' | 'absolute' | 'transport';

export interface OfferValidationLine {
  lineSubtotal?: number;
  productTypeId?: string;
  categoryIds?: string[];
}

export interface ValidateForCartInput {
  code: string;
  userId?: string;
  subtotal: number;
  lineItems?: OfferValidationLine[];
  now?: Date;
}

export interface ValidateForCartResult {
  ok: boolean;
  type?: OfferType;
  discountToman: number;
  transportFree: boolean;
  reason?: string;
  offer?: OfferDocument;
}

function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

function computeEligibleSubtotal(
  subtotal: number,
  lineItems: OfferValidationLine[] | undefined,
  allowedProductTypeIds: mongoose.Types.ObjectId[] | undefined,
  allowedCategoryIds: mongoose.Types.ObjectId[] | undefined
) {
  const hasProductTypeRestriction = !!(allowedProductTypeIds && allowedProductTypeIds.length);
  const hasCategoryRestriction = !!(allowedCategoryIds && allowedCategoryIds.length);

  if (!hasProductTypeRestriction && !hasCategoryRestriction) {
    return subtotal;
  }

  if (!lineItems || lineItems.length === 0) {
    return 0;
  }

  const productTypeSet = new Set<string>((allowedProductTypeIds ?? []).map(String));
  const categorySet = new Set<string>((allowedCategoryIds ?? []).map(String));

  let eligible = 0;

  for (const line of lineItems) {
    const matchesProductType =
      !hasProductTypeRestriction || (line.productTypeId && productTypeSet.has(String(line.productTypeId)));

    const matchesCategory =
      !hasCategoryRestriction ||
      (line.categoryIds && line.categoryIds.some((categoryId) => categorySet.has(String(categoryId))));

    if (matchesProductType && matchesCategory) {
      eligible += line.lineSubtotal ?? 0;
    }
  }

  return eligible;
}

export async function validateForCart(input: ValidateForCartInput): Promise<ValidateForCartResult> {
  const { subtotal, userId, now = new Date(), lineItems } = input;
  const code = normalizeCode(input.code);

  if (!code) {
    return { ok: false, discountToman: 0, transportFree: false, reason: 'code_required' };
  }

  const offer = await OfferModel.findOne({ code }).exec();
  if (!offer) {
    return { ok: false, discountToman: 0, transportFree: false, reason: 'not_found' };
  }

  if (!offer.isActive) {
    return { ok: false, discountToman: 0, transportFree: false, reason: 'inactive' };
  }

  if (offer.startsAt && now < offer.startsAt) {
    return { ok: false, discountToman: 0, transportFree: false, reason: 'not_started' };
  }

  if (offer.endsAt && now > offer.endsAt) {
    return { ok: false, discountToman: 0, transportFree: false, reason: 'expired' };
  }

  if (offer.usageLimitTotal != null && offer.timesRedeemed >= offer.usageLimitTotal) {
    return { ok: false, discountToman: 0, transportFree: false, reason: 'usage_limit_reached' };
  }

  if (offer.allowedUserIds && offer.allowedUserIds.length) {
    if (!userId) {
      return { ok: false, discountToman: 0, transportFree: false, reason: 'user_required' };
    }
    const allowedUsers = new Set(offer.allowedUserIds.map(String));
    if (!allowedUsers.has(userId)) {
      return { ok: false, discountToman: 0, transportFree: false, reason: 'user_not_allowed' };
    }
  }

  if (offer.usageLimitPerUser && offer.usageLimitPerUser > 0 && userId) {
    const redemption = await OfferRedemptionModel.findOne({ offerId: offer._id, userId }).lean();
    if (redemption && redemption.count >= offer.usageLimitPerUser) {
      return { ok: false, discountToman: 0, transportFree: false, reason: 'per_user_limit_reached' };
    }
  }

  const eligibleSubtotal = computeEligibleSubtotal(
    subtotal,
    lineItems,
    offer.allowedProductTypeIds,
    offer.allowedCategoryIds
  );

  if (
    ((offer.allowedProductTypeIds && offer.allowedProductTypeIds.length) ||
      (offer.allowedCategoryIds && offer.allowedCategoryIds.length)) &&
    eligibleSubtotal <= 0
  ) {
    return { ok: false, discountToman: 0, transportFree: false, reason: 'no_eligible_lines' };
  }

  if (offer.minOrderSubtotal && subtotal < offer.minOrderSubtotal) {
    return { ok: false, discountToman: 0, transportFree: false, reason: 'min_subtotal' };
  }

  let discount = 0;
  let transportFree = false;

  switch (offer.type) {
    case 'percentage': {
      if (offer.amount == null) {
        return { ok: false, discountToman: 0, transportFree: false, reason: 'invalid_percentage_amount' };
      }
      discount = floorInt((eligibleSubtotal * offer.amount) / 100);
      break;
    }
    case 'absolute': {
      if (offer.amount == null) {
        return { ok: false, discountToman: 0, transportFree: false, reason: 'invalid_absolute_amount' };
      }
      discount = Math.min(eligibleSubtotal, offer.amount);
      break;
    }
    case 'transport': {
      transportFree = true;
      discount = 0;
      break;
    }
    default:
      return { ok: false, discountToman: 0, transportFree: false, reason: 'unsupported_type' };
  }

  discount = clampNonNegative(discount);

  return { ok: true, type: offer.type, discountToman: discount, transportFree, offer };
}

interface RedeemAtomicInput {
  code: string;
  userId?: string;
  session?: ClientSession;
}

interface RedeemAtomicResult {
  ok: boolean;
  reason?: string;
}

interface ReleaseRedemptionInput {
  code?: string | null;
  userId?: unknown;
  session?: ClientSession;
}

async function redeemWithSession(
  session: ClientSession,
  code: string,
  userId?: string
): Promise<RedeemAtomicResult> {
  const offer = await OfferModel.findOne({ code }, null, { session });
  if (!offer) {
    return { ok: false, reason: 'not_found' };
  }

  if (offer.usageLimitTotal != null && offer.timesRedeemed >= offer.usageLimitTotal) {
    return { ok: false, reason: 'usage_limit_reached' };
  }

  if (offer.usageLimitPerUser && offer.usageLimitPerUser > 0) {
    if (!userId) {
      return { ok: false, reason: 'user_required' };
    }

    const redemption = await OfferRedemptionModel.findOneAndUpdate(
      { offerId: offer._id, userId },
      { $inc: { count: 1 }, $setOnInsert: { offerId: offer._id, userId } },
      { session, new: true, upsert: true, setDefaultsOnInsert: true }
    );

    if (redemption.count > offer.usageLimitPerUser) {
      return { ok: false, reason: 'per_user_limit_reached' };
    }
  }

  const filter: Record<string, unknown> = { _id: offer._id };
  if (offer.usageLimitTotal != null) {
    filter.timesRedeemed = { $lt: offer.usageLimitTotal };
  }

  const updateResult = await OfferModel.updateOne(filter, { $inc: { timesRedeemed: 1 } }, { session });
  if (updateResult.modifiedCount !== 1) {
    return { ok: false, reason: 'usage_limit_reached' };
  }

  return { ok: true };
}

async function redeemWithoutTransaction(
  code: string,
  userId?: string
): Promise<RedeemAtomicResult> {
  const offer = await OfferModel.findOne({ code });
  if (!offer) {
    return { ok: false, reason: 'not_found' };
  }

  if (offer.usageLimitTotal != null && offer.timesRedeemed >= offer.usageLimitTotal) {
    return { ok: false, reason: 'usage_limit_reached' };
  }

  let redemptionDoc: OfferRedemptionDocument | null = null;
  if (offer.usageLimitPerUser && offer.usageLimitPerUser > 0) {
    if (!userId) {
      return { ok: false, reason: 'user_required' };
    }

    redemptionDoc = await OfferRedemptionModel.findOneAndUpdate(
      { offerId: offer._id, userId },
      { $inc: { count: 1 }, $setOnInsert: { offerId: offer._id, userId } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    if ((redemptionDoc?.count ?? 0) > offer.usageLimitPerUser) {
      if (redemptionDoc) {
        await OfferRedemptionModel.updateOne({ _id: redemptionDoc._id }, { $inc: { count: -1 } });
      }
      return { ok: false, reason: 'per_user_limit_reached' };
    }
  }

  const filter: Record<string, unknown> = { _id: offer._id };
  if (offer.usageLimitTotal != null) {
    filter.timesRedeemed = { $lt: offer.usageLimitTotal };
  }

  const updateResult = await OfferModel.updateOne(filter, { $inc: { timesRedeemed: 1 } });
  if (updateResult.modifiedCount !== 1) {
    if (redemptionDoc) {
      await OfferRedemptionModel.updateOne({ _id: redemptionDoc._id }, { $inc: { count: -1 } });
    }
    return { ok: false, reason: 'usage_limit_reached' };
  }

  return { ok: true };
}

export async function redeemAtomic({ code, userId, session }: RedeemAtomicInput): Promise<RedeemAtomicResult> {
  const normalized = normalizeCode(code);

  if (session) {
    return redeemWithSession(session, normalized, userId);
  }

  if (!supportsMongoTransactions()) {
    return redeemWithoutTransaction(normalized, userId);
  }

  const localSession = await mongoose.startSession();
  let result: RedeemAtomicResult = { ok: false, reason: 'unknown' };

  try {
    await localSession.withTransaction(async () => {
      result = await redeemWithSession(localSession, normalized, userId);
      if (!result.ok) {
        await localSession.abortTransaction();
      }
    });
  } catch (error) {
    if ((error as { code?: number }).code === 20) {
      return redeemWithoutTransaction(normalized, userId);
    }
    throw error;
  } finally {
    await localSession.endSession();
  }

  return result;
}

export async function releaseRedemption({ code, userId, session }: ReleaseRedemptionInput): Promise<void> {
  const normalized = typeof code === 'string' ? normalizeCode(code) : '';
  if (!normalized) return;

  const offer = await OfferModel.findOne({ code: normalized }, null, { session });
  if (!offer) return;

  await OfferModel.updateOne(
    { _id: offer._id, timesRedeemed: { $gt: 0 } },
    { $inc: { timesRedeemed: -1 } },
    { session },
  );

  if (!userId) return;

  await OfferRedemptionModel.updateOne(
    { offerId: offer._id, userId, count: { $gt: 0 } },
    { $inc: { count: -1 } },
    { session },
  );
}
