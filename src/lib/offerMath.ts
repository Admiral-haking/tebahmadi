export function calcOfferAmountToman(baseAmount: number, percent: number): number {
  if (percent <= 0 || baseAmount <= 0) {
    return 0;
  }

  return Math.ceil(((baseAmount / 1000) / 100) * percent) * 1000;
}
