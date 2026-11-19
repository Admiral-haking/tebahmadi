import { loadSiteConfig } from '@/lib/cache';
import { sendSmsIrVerifyCode } from '@/integrations/smsir';

export interface SmsTemplateBinding { template: string; variables: string[] }
type SmsTemplateKind = 'loginCode' | 'orderConfirmation' | 'paymentReceipt' | 'shipmentTracking' | 'reviewRequest';
const DEFAULT_LOGIN_TEMPLATE: SmsTemplateBinding = { template: '', variables: ['code'] };

function provider(): 'mock' | 'sms_ir' {
  const value = (process.env.SMS_PROVIDER || (process.env.NODE_ENV === 'production' ? 'sms_ir' : 'mock')).trim().toLowerCase();
  if (value === 'mock') return 'mock';
  if (value === 'sms_ir' || value === 'sms.ir' || value === 'smsir') return 'sms_ir';
  throw new Error('sms_provider_invalid');
}

function normalizeMobile(value: string): string {
  const digits = value.replace(/[\s()-]/g, '').replace(/^\+98/, '0').replace(/^0098/, '0');
  if (!/^09\d{9}$/.test(digits)) throw new Error('sms_mobile_invalid');
  return digits;
}

async function resolveTemplate(kind: SmsTemplateKind): Promise<SmsTemplateBinding | null> {
  const entry = (await loadSiteConfig())?.smsTemplates?.[kind];
  return entry?.template ? { template: entry.template, variables: entry.variables ?? [] } : null;
}

function templateId(): number {
  const id = Number(process.env.SMS_IR_OTP_TEMPLATE_ID || process.env.SMS_IR_TEMPLATE_ID || '');
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error('sms_template_not_configured');
  return id;
}

export async function sendLoginCode(receptor: string, code: string): Promise<void> {
  const mobile = normalizeMobile(receptor);
  if (provider() === 'mock') {
    if (process.env.NODE_ENV !== 'production') console.info('[sms:mock] login code requested');
    return;
  }
  await sendSmsIrVerifyCode({ apiKey: process.env.SMS_IR_API_KEY || '', templateId: templateId(), parameterName: process.env.SMS_IR_TEMPLATE_PARAMETER || 'CODE' }, mobile, code);
}

async function sendConfiguredTemplate(kind: SmsTemplateKind, receptor: string, data: Record<string, unknown>): Promise<void> {
  const binding = await resolveTemplate(kind);
  if (!binding || provider() === 'mock') return;
  void receptor; void data;
}

export async function sendOrderConfirmationSms(receptor: string, data: Record<string, unknown>) { return sendConfiguredTemplate('orderConfirmation', receptor, data); }
export async function sendPaymentReceiptSms(receptor: string, data: Record<string, unknown>) { return sendConfiguredTemplate('paymentReceipt', receptor, data); }
export async function sendShipmentTrackingSms(receptor: string, data: Record<string, unknown>) { return sendConfiguredTemplate('shipmentTracking', receptor, data); }
export async function sendReviewRequestSms(receptor: string, data: Record<string, unknown>) { return sendConfiguredTemplate('reviewRequest', receptor, data); }
export { normalizeMobile };
