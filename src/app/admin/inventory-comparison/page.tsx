import { buildAdminMetadata } from "@/lib/admin-metadata";
import InventoryComparisonView from "@/views/admin/inventory-comparison";
import { isAdminFeatureEnabled } from "@/config/admin-features";
import { notFound } from "next/navigation";

const PAGE_TITLE = "مقایسه موجودی";

export async function generateMetadata() {
  return buildAdminMetadata(PAGE_TITLE);
}

export default function Page() {
  if (!isAdminFeatureEnabled("inventoryComparison")) notFound();
  return <InventoryComparisonView />;
}
