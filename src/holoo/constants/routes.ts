/**
 * Holoo web service endpoints, all relative to HOLOO_BASE_URL.
 *
 * Note: the vendor docs show a stray `/api/` prefix on some write endpoints
 * (e.g. `{Address}/api/Product`) while the base address already ends in `/api`.
 * That double `/api` is a documentation copy/paste artefact — every endpoint is
 * mounted directly under the base, so we use the un-prefixed paths here. If a
 * particular install really does nest under `/api`, fold it into HOLOO_BASE_URL.
 */
export const holooRoutes = {
    login: "/Login",

    // Level 1 — base data lists (GET)
    customer: "/Customer",
    mainGroup: "/MainGroup",
    sideGroup: "/SideGroup",
    unit: "/Unit",
    product: "/Product",

    // Level 2 — documents
    invoice: "/Invoice",
    preInvoice: "/Invoice/PreInvoice",
    order: "/Invoice/Order",
    invoiceDoc: "/Invoice/Invoice",
    preInvoiceInfo: "/Invoice/PreInvoiceInfo",
    orderInfo: "/Invoice/OrderInfo",

    // Payments
    havaleh: "/Payment/Havaleh",
    receiveFromCustomer: "/Payment/ReceiveFromCustomer",

    // Reports
    report: {
        sarfasl: "/Report/GetSarfasl",
        cash: "/Report/GetCash",
        account: "/Report/GetAccound", // (sic) — Holoo's own spelling
        maxBesCustomer: "/Report/GetMaxBesCustomer",
        maxBedCustomer: "/Report/GetMaxBedCustomer",
        maxFewProduct: "/Report/GetMaxFewProduct",
        minFewProduct: "/Report/GetMinFewProduct",
        maxSelFewProduct: "/Report/GetMaxSelFewProduct",
        minSelFewProduct: "/Report/GetMinSelFewProduct",
        maxSelPriceProduct: "/Report/GetMaxSelPriceProduct",
        minSelPriceProduct: "/Report/GetMinSelPriceProduct",
        kardexSarfasl: "/Report/GetKardexSarfasl",
        custPay: "/Report/GetCustPay",
    },
} as const;

export type HolooReportKey = keyof typeof holooRoutes.report;
