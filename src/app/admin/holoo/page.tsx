import { buildAdminMetadata } from "@/lib/admin-metadata";
import HolooHomeView from "@/views/admin/holoo";

export async function generateMetadata() {
    return buildAdminMetadata("حسابداری هلو");
}

export default function Page() {
    return <HolooHomeView />;
}
