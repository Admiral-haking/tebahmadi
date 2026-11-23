import { buildAdminMetadata } from "@/lib/admin-metadata";
import { hasDeveloperAccessFromCookies } from "@/lib/developer-access";
import { requireAuthenticatedUser } from "@/lib/require-auth";
import PaymentQualityView from "@/views/admin/payment-quality";
import { redirect } from "next/navigation";

const PAGE_TITLE = "کنترل کیفیت پرداخت‌ها";

export async function generateMetadata() {
  return buildAdminMetadata(PAGE_TITLE);
}

export default async function Page() {
  await requireAuthenticatedUser("/admin/payment-quality");
  if (!(await hasDeveloperAccessFromCookies())) {
    redirect("/admin?developer=required");
  }

  return <PaymentQualityView />;
}
