import { buildAdminMetadata } from "@/lib/admin-metadata";
import SnappHomeView from "@/views/admin/snapp";

export async function generateMetadata() {
    return buildAdminMetadata("اسنپ");
}

export default function Page() {
    return <SnappHomeView />
}