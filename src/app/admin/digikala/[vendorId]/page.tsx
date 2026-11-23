import { buildAdminMetadata } from "@/lib/admin-metadata";
import DigikalaPanel from "@/views/admin/digikala/panel";
import { isAdminFeatureEnabled } from "@/config/admin-features";
import { notFound } from "next/navigation";

export async function generateMetadata() {
    return buildAdminMetadata("دیجی کالا");
}


type RouteParams = Promise<{ vendorId: string }>;

export default async function Page({
    params,
}: {
    params: RouteParams;
}) {
    if (!isAdminFeatureEnabled("digikala")) notFound();
    const { vendorId } = await params;

    return <DigikalaPanel vendorId={decodeURIComponent(vendorId)} />
}
