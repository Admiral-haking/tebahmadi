import AdminHelpView from "@/views/admin/help";
import { buildAdminMetadata } from "@/lib/admin-metadata";

const PAGE_TITLE = "آموزش کار با پنل مدیریت";

export async function generateMetadata() {
  return buildAdminMetadata(PAGE_TITLE);
}

export default function Page() {
  return <AdminHelpView />;
}
