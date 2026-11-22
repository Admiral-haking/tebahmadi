import { buildAdminMetadata } from "@/lib/admin-metadata";
import SnappHomeView from "@/views/admin/snapp";
import { isAdminFeatureEnabled } from "@/config/admin-features";
import { notFound } from "next/navigation";

export async function generateMetadata() {
    return buildAdminMetadata("صفحه پیدا نشد");
}

export default function Page() {
    if (!isAdminFeatureEnabled("snapp")) notFound();
    return <SnappHomeView />
}
