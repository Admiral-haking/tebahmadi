import { buildAdminMetadata } from "@/lib/admin-metadata";
import Tracking from "@/views/admin/tracking";

export async function generateMetadata() {
    return buildAdminMetadata("پیگیری سفارش");
}

export default function Page() {
    return <Tracking />
}