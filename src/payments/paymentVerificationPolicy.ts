import { isPaymentGatewayAllowed } from './paymentGatewayControls';
import type { PaymentGateway } from './paymentTypes';

const DISABLED_GATEWAY_MESSAGE = 'درگاه پرداخت در حال حاضر فعال نیست.';

export type PaymentVerificationDecision =
  | { allowed: true }
  | { allowed: false; message: string };

export function getPaymentVerificationDecision(
  gateway: PaymentGateway,
): PaymentVerificationDecision {
  if (!isPaymentGatewayAllowed(gateway)) {
    return { allowed: false, message: DISABLED_GATEWAY_MESSAGE };
  }

  return { allowed: true };
}
