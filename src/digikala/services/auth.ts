import { POST } from "@/utils/fetch";
import { dgkApiRoutes } from "../constants/routes";
import { getServiceInfo, setServiceInfo } from "@/settings/services/servicesService";
import decryptDgkAuthorizationCode from "../utils/decrypt";
import { clearDgkAuthDead } from "../utils/auth-state";



export async function dgk_auth_token(authorization_code: string, vendorId: string) {
    const { privateKey } = await getServiceInfo("dgk", "keys", vendorId);

    authorization_code = decryptDgkAuthorizationCode(authorization_code, privateKey);

    const { data } = await POST(dgkApiRoutes.auth_token, { authorization_code })
    await setServiceInfo("dgk", "auth_token", vendorId, data)
    clearDgkAuthDead(vendorId); // fresh creds → lift any re-auth cooldown
    return data as {
        "access_token": string,
        "refresh_token": string,
        "access_token_expires_at": {
            "date": string,
            "timezone_type": number,
            "timezone": "Asia/Tehran"
        },
        "refresh_token_expires_at": {
            "date": string,
            "timezone_type": 3,
            "timezone": "Asia/Tehran"
        }
    };
}
export async function dgk_auth_refresh_token(body: { access_token: string, refresh_token: string }, vendorId: string) {
    const { data } = await POST(dgkApiRoutes.auth_refresh_token, body)
    await setServiceInfo("dgk", "auth_token", vendorId, data)
    return data as {
        "access_token": string,
        "refresh_token": string,
        "access_token_expires_at": {
            "date": string,
            "timezone_type": number,
            "timezone": "Asia/Tehran"
        },
        "refresh_token_expires_at": {
            "date": string,
            "timezone_type": 3,
            "timezone": "Asia/Tehran"
        }
    };
}