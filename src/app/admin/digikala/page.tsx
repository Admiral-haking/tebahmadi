import { buildAdminMetadata } from "@/lib/admin-metadata";
import DigikalaHomeView from "@/views/admin/digikala";
import { isAdminFeatureEnabled } from "@/config/admin-features";
import { notFound } from "next/navigation";

export async function generateMetadata() {
    return buildAdminMetadata("صفحه پیدا نشد");
}

export default function Page() {
    if (!isAdminFeatureEnabled("digikala")) notFound();
    return <DigikalaHomeView />
}
