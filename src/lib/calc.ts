export type WeightUnit = 'g' | 'kg';

const UNIT_FACTORS: Record<WeightUnit, number> = {
  g: 1,
  kg: 1000,
};

export function toGrams(value: number, unit: WeightUnit): number {
  return Math.round(value * UNIT_FACTORS[unit]);
}

export function convertWeight(value: number, from: WeightUnit, to: WeightUnit): number {
  const grams = value * UNIT_FACTORS[from];
  return grams / UNIT_FACTORS[to];
}

export function ceilSteps(excess: number, stepWeight: number): number {
  if (stepWeight <= 0) {
    throw new Error('Step weight must be greater than zero');
  }
  if (excess <= 0) {
    return 0;
  }
  return Math.ceil(excess / stepWeight);
}

export function clampNonNegative(value: number): number {
  return value < 0 ? 0 : value;
}

export function floorInt(value: number): number {
  return Math.floor(value);
}

export function sum(values: number[]): number {
  return values.reduce((acc, current) => acc + current, 0);
}
