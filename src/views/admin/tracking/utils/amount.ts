import { ITRackServiceIdType } from "../type";

export function normalizeServiceAmount(serviceId: ITRackServiceIdType | string, amount: number) {
    switch (serviceId) {
        case "dgk": return (amount / 10).toLocaleString("IR-fa").concat(" ", "تومان")
        case "basalaam": return (amount / 10).toLocaleString("IR-fa").concat(" ", "تومان")
        case "snapp": return (amount / 10).toLocaleString("IR-fa").concat(" ", "تومان")
        case "website":
        default: return (amount).toLocaleString("IR-fa").concat(" ", "تومان")
    }
}