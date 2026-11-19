import { getServiceInfo, setServiceInfo } from "@/settings/services/servicesService"
import { Get } from "@/utils/fetch";
import { SnappVendorsResponse } from "../api/type";
import { snappApiRoutes } from "../constants/routes";

export async function snpSetToken(vendorId: string, token: string, client_secret: string) {
    try {
        const res = Get<SnappVendorsResponse>(snappApiRoutes.vendors, {
            'User-Agent': client_secret,
            'Authorization': `Bearer ${token}`
        });
        await setServiceInfo("snapp", "token", vendorId, {
            token,
            client_secret
        })

        return res;
    } catch (err: any) {
        return err.data?.message ?? err.status === 401 ? "اطلاعات وارد شده صحیح نیست" : "خطای ناشناخته حین احراز هویت"
    }
}


export async function snpGetToken(vendorId: string) {
    const data = await getServiceInfo("snapp", "token", vendorId);

    if (!data) throw new Error("اطلاعات احراز هویت اسنپ یافت نشد.");

    return {
        'User-Agent': data.client_secret,
        'Authorization': `Bearer ${data.token}`
    }
}