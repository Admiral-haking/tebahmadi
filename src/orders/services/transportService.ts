import { type Types } from 'mongoose';
import { TransportModel, type TransportDocument } from '@/orders/models/Transport';
import { ceilSteps, toGrams } from '@/lib/calc';
import { deriveProvinceCityFromRegion, isCityInProvince } from '@/utils/location';

export interface QuoteShippingInput {
  carrierId: string | Types.ObjectId;
  totalWeightGrams: number;
  destinationState?: string | null;
  destinationCity?: string | null;
  destinationRegion?: string | null;
}

interface QuoteShippingSuccess {
  ok: true;
  price: number;
  breakdown: { basePrice: number; steps: number; stepPrice: number };
  carrier: TransportDocument;
  rowIndex: number;
}

interface QuoteShippingFailure {
  ok: false;
  reason: string;
}

export type QuoteShippingResult = QuoteShippingSuccess | QuoteShippingFailure;

const normalize = (value?: string | null) => value?.trim().toLowerCase() ?? '';
const compact = (value: string) => value.replace(/\s+/g, '');

function scorePricingRow(
  rawRegion: string | undefined,
  destinationStateNorm: string,
  destinationCityNorm: string,
  destinationRegionNorm: string,
): number {
  const normalizedRegion = normalize(rawRegion);
  if (!normalizedRegion) {
    return 1; // generic fallback row
  }

  const { province: rowProvince, city: rowCity } = deriveProvinceCityFromRegion(rawRegion);
  const rowCityNorm = normalize(rowCity);

  // Exact city match
  if (destinationCityNorm) {
    if (
      rowCityNorm &&
      (rowCityNorm === destinationCityNorm ||
        compact(rowCityNorm) === compact(destinationCityNorm) ||
        normalizedRegion === destinationCityNorm ||
        compact(normalizedRegion) === compact(destinationCityNorm) ||
        normalizedRegion.includes(destinationCityNorm))
    ) {
      return 5;
    }
  }

  // No match
  return 0;
}

function pickPricingRow(
  carrier: TransportDocument,
  destinationState?: string | null,
  destinationCity?: string | null,
  destinationRegion?: string | null,
): number {
  const pricingRows = carrier.pricingRows ?? [];
  if (pricingRows.length === 0) {
    return 0;
  }

  const destinationStateNorm = normalize(destinationState);
  const destinationCityNorm = normalize(destinationCity);
  const destinationRegionNorm = normalize(destinationRegion);

  let bestIndex = -1;
  let bestScore = -1;

  pricingRows.forEach((row, index) => {
    const score = scorePricingRow(
      typeof row.destRegion === 'string' ? row.destRegion : undefined,
      destinationStateNorm,
      destinationCityNorm,
      destinationRegionNorm,
    );

    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });

  if (bestIndex >= 0) {
    return bestIndex;
  }

  return 0;
}

export async function quoteShipping({
  carrierId,
  totalWeightGrams,
  destinationState,
  destinationCity,
  destinationRegion,
}: QuoteShippingInput): Promise<QuoteShippingResult> {
  const carrier = await TransportModel.findById(carrierId).exec();

  if (!carrier) {
    return { ok: false, reason: 'not_found' };
  }

  if (!carrier.isActive) {
    return { ok: false, reason: 'inactive' };
  }

  if (!carrier.pricingRows || carrier.pricingRows.length === 0) {
    return { ok: false, reason: 'no_pricing_rows' };
  }

  const rowIndex = pickPricingRow(carrier, destinationState, destinationCity, destinationRegion);

  const row = carrier.pricingRows[rowIndex];

  const baseLimitGrams = toGrams(row.baseWeightLimit, row.baseWeightUnit);

  if (row.maxWeight != null) {
    const maxWeightGrams = toGrams(row.maxWeight, row.baseWeightUnit);
    if (totalWeightGrams > maxWeightGrams) {
      return { ok: false, reason: 'over_max_weight' };
    }
  }

  if (totalWeightGrams <= baseLimitGrams) {
    return {
      ok: true,
      price: row.basePrice,
      breakdown: { basePrice: row.basePrice, steps: 0, stepPrice: row.overageStepPrice },
      carrier,
      rowIndex,
    };
  }

  const excessGrams = totalWeightGrams - baseLimitGrams;
  const stepWeightGrams = toGrams(row.overageStepWeight, row.overageStepUnit);
  const steps = ceilSteps(excessGrams, stepWeightGrams);
  const price = row.basePrice + steps * row.overageStepPrice;

  return {
    ok: true,
    price,
    breakdown: { basePrice: row.basePrice, steps, stepPrice: row.overageStepPrice },
    carrier,
    rowIndex,
  };
}
