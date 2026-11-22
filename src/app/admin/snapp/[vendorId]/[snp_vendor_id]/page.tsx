import { buildAdminMetadata } from "@/lib/admin-metadata";
import SnappPanel from "@/views/admin/snapp/panel";
import { isAdminFeatureEnabled } from "@/config/admin-features";
import { notFound } from "next/navigation";

export async function generateMetadata() {
    return buildAdminMetadata("اسنپ");
}


type RouteParams = Promise<{ vendorId: string, snp_vendor_id: string }>;

export default async function Page({
    params,
}: {
    params: RouteParams;
}) {
    if (!isAdminFeatureEnabled("snapp")) notFound();
    const { vendorId, snp_vendor_id } = await params;

    return <SnappPanel vendorId={decodeURIComponent(vendorId)} snpVendorId={decodeURIComponent(snp_vendor_id)} />
}
