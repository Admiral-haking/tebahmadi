import SiteInfoSettingsView from "@/views/admin/site-settings/site-info";
import { buildAdminMetadata } from "@/lib/admin-metadata";

const PAGE_TITLE = "تنظیمات اطلاعات پایه سایت";

export async function generateMetadata() {
    return buildAdminMetadata(PAGE_TITLE);
}

export default function Page() {
    return <SiteInfoSettingsView />;
}
