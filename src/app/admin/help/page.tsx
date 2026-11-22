import AdminHelpView from "@/views/admin/help";
import { buildAdminMetadata } from "@/lib/admin-metadata";
import { isAdminFeatureEnabled } from "@/config/admin-features";
import { notFound } from "next/navigation";

const PAGE_TITLE = "آموزش کار با پنل مدیریت";

export async function generateMetadata() {
  return buildAdminMetadata(PAGE_TITLE);
}

export default function Page() {
  if (!isAdminFeatureEnabled("help")) notFound();
  return <AdminHelpView />;
}
