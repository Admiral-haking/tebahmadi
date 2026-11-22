import { buildAdminMetadata } from "@/lib/admin-metadata";
import DigikalaHomeView from "@/views/admin/digikala";
import { isAdminFeatureEnabled } from "@/config/admin-features";
import { notFound } from "next/navigation";

export async function generateMetadata() {
    return buildAdminMetadata("دیجی کالا");
}

export default function Page() {
    if (!isAdminFeatureEnabled("digikala")) notFound();
    return <DigikalaHomeView />
}
