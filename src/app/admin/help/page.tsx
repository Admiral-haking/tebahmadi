import AdminHelpView from "@/views/admin/help";
import { buildAdminMetadata } from "@/lib/admin-metadata";
import { isAdminFeatureEnabled } from "@/config/admin-features";
import { notFound } from "next/navigation";

export async function generateMetadata() {
  return buildAdminMetadata("صفحه پیدا نشد");
}

export default function Page() {
  if (!isAdminFeatureEnabled("help")) notFound();
  return <AdminHelpView />;
}
