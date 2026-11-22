import { buildAdminMetadata } from "@/lib/admin-metadata";
import BasalaamHomeView from "@/views/admin/basalaam";
import { isAdminFeatureEnabled } from "@/config/admin-features";
import { notFound } from "next/navigation";

export async function generateMetadata() {
    return buildAdminMetadata("صفحه پیدا نشد");
}

export default function Page() {
    if (!isAdminFeatureEnabled("basalaam")) notFound();
    return <BasalaamHomeView />
}
