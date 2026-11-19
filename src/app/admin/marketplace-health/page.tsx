import { buildAdminMetadata } from "@/lib/admin-metadata";
import MarketplaceHealthView from "@/views/admin/marketplace-health";

const PAGE_TITLE = "سلامت مارکت‌پلیس‌ها";

export async function generateMetadata() {
  return buildAdminMetadata(PAGE_TITLE);
}

export default function Page() {
  return <MarketplaceHealthView />;
}
