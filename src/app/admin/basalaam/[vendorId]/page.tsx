import { buildAdminMetadata } from "@/lib/admin-metadata";
import BasalaamPanel from "@/views/admin/basalaam/panel";
import { isAdminFeatureEnabled } from "@/config/admin-features";
import { notFound } from "next/navigation";

export async function generateMetadata() {
    return buildAdminMetadata("باسلام");
}


type RouteParams = Promise<{ vendorId: string }>;

export default async function Page({
    params,
}: {
    params: RouteParams;
}) {
    if (!isAdminFeatureEnabled("basalaam")) notFound();
    const { vendorId } = await params;

    return <BasalaamPanel vendorId={decodeURIComponent(vendorId)} />
}
