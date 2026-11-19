import SiteConfigSettingsView from "@/views/admin/site-settings/site-config";
import { buildAdminMetadata } from "@/lib/admin-metadata";

const PAGE_TITLE = "تنظیمات پیکربندی سایت";

export async function generateMetadata() {
    return buildAdminMetadata(PAGE_TITLE);
}

export default function Page() {
    return <SiteConfigSettingsView />;
}
