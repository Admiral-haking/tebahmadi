import { buildAdminMetadata } from "@/lib/admin-metadata";
import { hasDeveloperAccessFromCookies } from "@/lib/developer-access";
import { requireAuthenticatedUser } from "@/lib/require-auth";
import ErrorLogsView from "@/views/admin/error-logs";
import { redirect } from "next/navigation";

const PAGE_TITLE = "لاگ خطاها";

export async function generateMetadata() {
  return buildAdminMetadata(PAGE_TITLE);
}

export default async function Page() {
  await requireAuthenticatedUser("/admin/error-logs");
  if (!(await hasDeveloperAccessFromCookies())) {
    redirect("/admin?developer=required");
  }

  return <ErrorLogsView />;
}
