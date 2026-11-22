import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePermission } from '@/lib/auth';
import {
  getPaymentGatewayControls,
  isPaymentGateway,
  updatePaymentGatewayControls,
  type PaymentGatewayControlMap,
} from '@/payments/paymentGatewayControls';

const controlSchema = z.object({
  visible: z.boolean().optional(),
  enabled: z.boolean().optional(),
});

const updateSchema = z.object({
  controls: z.record(z.string(), controlSchema),
});

export async function GET(request: NextRequest) {
  await requirePermission(request, 'orders:write');
  return NextResponse.json({ data: await getPaymentGatewayControls() });
}

export async function PUT(request: NextRequest) {
  await requirePermission(request, 'orders:write');

  try {
    const body = updateSchema.parse(await request.json());
    const controls = Object.entries(body.controls).reduce<PaymentGatewayControlMap>(
      (acc, [gateway, value]) => {
        if (isPaymentGateway(gateway)) acc[gateway] = value;
        return acc;
      },
      {},
    );
    await updatePaymentGatewayControls(controls);
    return NextResponse.json({ data: await getPaymentGatewayControls() });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'payment_gateway_update_failed' },
      { status: 500 },
    );
  }
}
