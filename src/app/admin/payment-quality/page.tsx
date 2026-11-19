import { buildAdminMetadata } from "@/lib/admin-metadata";
import PaymentQualityView from "@/views/admin/payment-quality";

const PAGE_TITLE = "کنترل کیفیت پرداخت‌ها";

export async function generateMetadata() {
  return buildAdminMetadata(PAGE_TITLE);
}

export default function Page() {
  return <PaymentQualityView />;
}
