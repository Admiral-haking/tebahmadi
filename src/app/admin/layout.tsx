import AdminLayoutWrapper from "@/layout/admin/admin-layout-wrapper";
import NumberInputWheelGuard from "@/components/number-input-wheel-guard";

export const dynamic = "force-dynamic";

export default function Layout({ children }: ChildrenProps) {
    return <AdminLayoutWrapper>
        <NumberInputWheelGuard />
        {children}
    </AdminLayoutWrapper>
}
