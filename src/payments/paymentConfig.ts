import mongoose from 'mongoose';
import { buildCallbackUrl, ensureAppBaseUrl, normalizeCallbackPath } from './paymentCalc';
import type { PaymentGateway } from './paymentTypes';

export type BajetPayEnv = {
  baseUrl: string;
  terminalId: string;
  username: string;
  password: string;
};

export function normalizeBajetPayBaseUrl(value: string): string {
  const normalized = value.trim().replace(/\/+$/, '');
  return normalized.endsWith('/api/v1/jetpay')
    ? normalized
    : `${normalized}/api/v1/jetpay`;
}

export function getBajetPayEnv(): BajetPayEnv {
  const terminalId = process.env.BAJETPAY_TERMINAL_ID?.trim();
  const username = process.env.BAJETPAY_USERNAME?.trim();
  const password = process.env.BAJETPAY_PASSWORD?.trim();
  if (!terminalId || !username || !password) {
    throw new Error('BAJETPAY credentials are not configured');
  }

  return {
    baseUrl: normalizeBajetPayBaseUrl(process.env.BAJETPAY_BASE_URL ?? 'https://jetpay.mybajet.ir'),
    terminalId,
    username,
    password,
  };
}

export function getBajetPayCallbackPath(): string {
  return normalizeCallbackPath(
    process.env.BAJETPAY_CALLBACK_PATH ?? '/api/payments/bajetpay/callback',
  );
}

export function getPaymentCallbackBase() {
  const baseUrl = ensureAppBaseUrl(process.env.APP_BASE_URL);
  const callbackPath = normalizeCallbackPath(process.env.PAYMENT_CALLBACK_PATH);
  return { baseUrl, callbackPath };
}

export function buildGatewayCallbackUrl(input: {
  baseUrl: string;
  path: string;
  invoiceId: string;
  transactionId: mongoose.Types.ObjectId | string;
  gateway: PaymentGateway;
  state?: string;
}) {
  const url = new URL(
    buildCallbackUrl(input.baseUrl, input.path, input.invoiceId, input.transactionId),
  );
  url.searchParams.set('gateway', input.gateway);
  if (input.state) url.searchParams.set('state', input.state);
  return url.toString();
}
