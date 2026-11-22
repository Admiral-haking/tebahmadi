import { buildAdminMetadata } from '@/lib/admin-metadata';
import PaymentGatewayControlsView from '@/views/admin/payment-gateways';

const PAGE_TITLE = 'مدیریت درگاه‌های پرداخت';

export async function generateMetadata() {
  return buildAdminMetadata(PAGE_TITLE);
}

export default function Page() {
  return <PaymentGatewayControlsView />;
}
