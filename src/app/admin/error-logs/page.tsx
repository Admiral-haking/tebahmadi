import { buildAdminMetadata } from "@/lib/admin-metadata";
import ErrorLogsView from "@/views/admin/error-logs";

const PAGE_TITLE = "لاگ خطاها";

export async function generateMetadata() {
  return buildAdminMetadata(PAGE_TITLE);
}

export default function Page() {
  return <ErrorLogsView />;
}
