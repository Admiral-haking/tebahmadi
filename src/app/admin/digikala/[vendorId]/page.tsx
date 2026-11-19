import { buildAdminMetadata } from "@/lib/admin-metadata";
import DigikalaPanel from "@/views/admin/digikala/panel";

export async function generateMetadata() {
    return buildAdminMetadata("دیجی کالا");
}


type RouteParams = Promise<{ vendorId: string }>;

export default async function Page({
    params,
}: {
    params: RouteParams;
}) {
    const { vendorId } = await params;

    return <DigikalaPanel vendorId={decodeURIComponent(vendorId)} />
}