import { Get } from "@/utils/fetch"
import { bslApiRoutes } from "../constants/route"
import { getServiceInfo, setServiceInfo } from "@/settings/services/servicesService"

type AuthProps = {
    auth_token: string
    expires: number,
    vendorId: string
}

export async function bslAuth({ auth_token, expires, vendorId }: AuthProps) {
    const res = await Get<WhoamiResponse>(bslApiRoutes.whoami, {
        'Authorization': `Bearer ${auth_token}`
    });
    const me = await Get<UserVendorData>(bslApiRoutes.me, {
        'Authorization': `Bearer ${auth_token}`
    });
    await setServiceInfo("basalaam", "auth_token", vendorId, {
        auth_token,
        expires,
        ...me
    })
    return res;
}

export async function bslGetVendorStatus(vendorId: string) {
    const info = await getServiceInfo("basalaam", "auth_token", vendorId);
    if (!info) return { status: "یافت نشد", desc: "لطفا از پنل برنامه نویسان با سلام جهت دریافت توکن اقدام کنید." };
    if (info.expires < Date.now()) return { status: "منقضی شده.", desc: "لطفا از پنل برنامه نویسان توکن جدید دریافت کنید.", vendor: info.vendor }
    return { status: "فعال", desc: "توکن دسترسی دارای اعتبار می باشد.", vendor: info.vendor }
}

export async function bslBearerHeader(vendorId: string) {
    const info = await getServiceInfo("basalaam", "auth_token", vendorId);
    if (!info) {
        const error = new Error("توکن باسلام یافت نشد. لطفا از صفحه اصلی باسلام، دکمه 'ذخیره توکن' را کلیک کرده و توکن را وارد کنید.");
        (error as any).status = 401;
        (error as any).code = "BSL_TOKEN_NOT_FOUND";
        throw error;
    }
    return {
        headers: { 'Authorization': `Bearer ${info.auth_token}` },
        vendor_id: info.vendor.id
    }
}

interface WhoamiResponse {
    id: string;
    name: string;
    mobile: string;
    hash_id: string;
    client: { id: string; name: string; image_url: string };
}

interface UserVendorData {
    id: number;
    hash_id: string;
    username: string;
    name: string;
    vendor: { id: number; identifier: string; title: string };
}
