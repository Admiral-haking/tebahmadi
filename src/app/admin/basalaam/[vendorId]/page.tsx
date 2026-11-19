import { buildAdminMetadata } from "@/lib/admin-metadata";
import BasalaamPanel from "@/views/admin/basalaam/panel";

export async function generateMetadata() {
    return buildAdminMetadata("باسلام");
}


type RouteParams = Promise<{ vendorId: string }>;

export default async function Page({
    params,
}: {
    params: RouteParams;
}) {
    const { vendorId } = await params;

    return <BasalaamPanel vendorId={decodeURIComponent(vendorId)} />
}