import { buildAdminMetadata } from "@/lib/admin-metadata";
import DigikalaHomeView from "@/views/admin/digikala";

export async function generateMetadata() {
    return buildAdminMetadata("دیجی کالا");
}

export default function Page() {
    return <DigikalaHomeView />
}