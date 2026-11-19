import { holooRequest } from "./client";
import { holooRoutes, type HolooReportKey } from "../constants/routes";

type ReportParams = {
    code?: string;
    count?: number;
    "date.from"?: string;
    "date.to"?: string;
};

/**
 * Generic accessor for the Holoo Report/* endpoints (all GET). Pick the report
 * by key and pass the params it accepts; the raw Holoo payload is returned.
 */
export async function getHolooReport<T = any>(
    key: HolooReportKey,
    params: ReportParams = {},
): Promise<T> {
    return holooRequest<T>({
        method: "GET",
        path: holooRoutes.report[key],
        query: params as Record<string, string | number | undefined>,
    });
}

/** موجودی صندوق */
export const getHolooCash = (params: Pick<ReportParams, "date.from" | "date.to"> = {}) =>
    getHolooReport("cash", params);

/** موجودی بانک */
export const getHolooAccount = (params: Pick<ReportParams, "date.from" | "date.to"> = {}) =>
    getHolooReport("account", params);

/** سرفصل‌های حسابداری */
export const getHolooSarfasl = (params: ReportParams = {}) => getHolooReport("sarfasl", params);
