import { buildAdminMetadata } from "@/lib/admin-metadata";
import InventoryComparisonView from "@/views/admin/inventory-comparison";
import { isAdminFeatureEnabled } from "@/config/admin-features";
import { notFound } from "next/navigation";

export async function generateMetadata() {
  return buildAdminMetadata("صفحه پیدا نشد");
}

export default function Page() {
  if (!isAdminFeatureEnabled("inventoryComparison")) notFound();
  return <InventoryComparisonView />;
}
