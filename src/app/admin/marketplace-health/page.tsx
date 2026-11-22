import { buildAdminMetadata } from "@/lib/admin-metadata";
import MarketplaceHealthView from "@/views/admin/marketplace-health";
import { isAdminFeatureEnabled } from "@/config/admin-features";
import { notFound } from "next/navigation";

const PAGE_TITLE = "سلامت مارکت‌پلیس‌ها";

export async function generateMetadata() {
  return buildAdminMetadata(PAGE_TITLE);
}

export default function Page() {
  if (!isAdminFeatureEnabled("marketplaceHealth")) notFound();
  return <MarketplaceHealthView />;
}
