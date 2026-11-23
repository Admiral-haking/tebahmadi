import { buildAdminMetadata } from "@/lib/admin-metadata";
import HolooHomeView from "@/views/admin/holoo";
import { isAdminFeatureEnabled } from "@/config/admin-features";
import { notFound } from "next/navigation";

export async function generateMetadata() {
    return buildAdminMetadata("صفحه پیدا نشد");
}

export default function Page() {
    if (!isAdminFeatureEnabled("holoo")) notFound();
    return <HolooHomeView />;
}
