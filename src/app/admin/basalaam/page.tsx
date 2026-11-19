import { buildAdminMetadata } from "@/lib/admin-metadata";
import BasalaamHomeView from "@/views/admin/basalaam";

export async function generateMetadata() {
    return buildAdminMetadata("باسلام");
}

export default function Page() {
    return <BasalaamHomeView />
}