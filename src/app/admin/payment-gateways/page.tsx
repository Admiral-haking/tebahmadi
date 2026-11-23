import { buildAdminMetadata } from '@/lib/admin-metadata';
import { hasDeveloperAccessFromCookies } from '@/lib/developer-access';
import { requireAuthenticatedUser } from '@/lib/require-auth';
import PaymentGatewayControlsView from '@/views/admin/payment-gateways';
import { redirect } from 'next/navigation';

const PAGE_TITLE = 'مدیریت درگاه‌های پرداخت';

export async function generateMetadata() {
  return buildAdminMetadata(PAGE_TITLE);
}

export default async function Page() {
  await requireAuthenticatedUser('/admin/payment-gateways');
  if (!(await hasDeveloperAccessFromCookies())) {
    redirect('/admin?developer=required');
  }

  return <PaymentGatewayControlsView />;
}
