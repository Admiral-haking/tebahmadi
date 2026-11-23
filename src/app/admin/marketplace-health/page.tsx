import { buildAdminMetadata } from "@/lib/admin-metadata";
import MarketplaceHealthView from "@/views/admin/marketplace-health";
import { isAdminFeatureEnabled } from "@/config/admin-features";
import { notFound } from "next/navigation";

export async function generateMetadata() {
  return buildAdminMetadata("صفحه پیدا نشد");
}

export default function Page() {
  if (!isAdminFeatureEnabled("marketplaceHealth")) notFound();
  return <MarketplaceHealthView />;
}
