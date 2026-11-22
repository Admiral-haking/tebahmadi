import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, HttpError } from '@/lib/auth';
import { getTapinConfigFromEnv } from '@/integrations/tapin';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, 'orders:read');
    const smsProvider = (process.env.SMS_PROVIDER || (process.env.NODE_ENV === 'production' ? 'sms_ir' : 'mock')).toLowerCase();
    const tapinConfig = getTapinConfigFromEnv();
    return NextResponse.json({
      payment: { provider: 'existing', configured: Boolean(process.env.ZARINPAL_MERCHANT_ID) },
      shipping: { provider: 'tapin', configured: Boolean(tapinConfig.token && tapinConfig.shopId) },
      sms: { provider: smsProvider === 'mock' ? 'mock' : 'sms_ir', configured: smsProvider === 'mock' || Boolean(process.env.SMS_IR_API_KEY && (process.env.SMS_IR_OTP_TEMPLATE_ID || process.env.SMS_IR_TEMPLATE_ID)) },
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof HttpError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: 'خواندن وضعیت اتصال‌ها ناموفق بود' }, { status: 500 });
  }
}
