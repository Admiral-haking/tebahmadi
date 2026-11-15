export function paymentUpdateApplied(changes: unknown): boolean {
  return Number(changes) === 1;
}
