import { buildAdminMetadata } from "@/lib/admin-metadata";
import InventoryComparisonView from "@/views/admin/inventory-comparison";

const PAGE_TITLE = "مقایسه موجودی";

export async function generateMetadata() {
  return buildAdminMetadata(PAGE_TITLE);
}

export default function Page() {
  return <InventoryComparisonView />;
}
