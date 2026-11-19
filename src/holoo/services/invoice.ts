import { holooRequest } from "./client";
import { holooRoutes } from "../constants/routes";
import type {
    HolooInvoiceInput,
    HolooInvoiceListParams,
    HolooInvoiceSummary,
    HolooPreInvoiceInput,
    HolooSuccess,
} from "../types";

/** GET /Invoice — list invoices (report). */
export async function listHolooInvoices(
    params: HolooInvoiceListParams = {},
): Promise<HolooInvoiceSummary[]> {
    const res = await holooRequest<{ invoice?: HolooInvoiceSummary[] }>({
        method: "GET",
        path: holooRoutes.invoice,
        query: params as Record<string, string | undefined>,
    });
    return res?.invoice ?? [];
}

/** POST /Invoice/Invoice — create a sales / purchase / return invoice. */
export async function createHolooInvoice(
    input: HolooInvoiceInput,
): Promise<HolooSuccess["Success"]> {
    const res = await holooRequest<HolooSuccess>({
        method: "POST",
        path: holooRoutes.invoiceDoc,
        body: { invoiceinfo: [input] },
    });
    return res.Success;
}

/** POST /Invoice/PreInvoice — create a pre-invoice (پیش فاکتور). */
export async function createHolooPreInvoice(
    input: HolooPreInvoiceInput,
): Promise<HolooSuccess["Success"]> {
    const res = await holooRequest<HolooSuccess>({
        method: "POST",
        path: holooRoutes.preInvoice,
        body: { invoiceinfo: input },
    });
    return res.Success;
}

/**
 * POST /Invoice/Order — create an order (سفارش). Holoo requires `uniterpcode`
 * on every detail line for orders.
 */
export async function createHolooOrder(
    input: HolooPreInvoiceInput,
): Promise<HolooSuccess["Success"]> {
    const res = await holooRequest<HolooSuccess>({
        method: "POST",
        path: holooRoutes.order,
        body: { invoiceinfo: input },
    });
    return res.Success;
}

/** GET /Invoice/PreInvoiceInfo — resolve a pre-invoice number from its ErpCode. */
export async function getHolooPreInvoiceInfo(erpcode: string): Promise<HolooSuccess["Success"]> {
    const res = await holooRequest<HolooSuccess>({
        method: "GET",
        path: holooRoutes.preInvoiceInfo,
        query: { invoiceinfo: JSON.stringify({ erpcode }) },
    });
    return res.Success;
}

/** GET /Invoice/OrderInfo — resolve an order number from its ErpCode. */
export async function getHolooOrderInfo(erpcode: string): Promise<HolooSuccess["Success"]> {
    const res = await holooRequest<HolooSuccess>({
        method: "GET",
        path: holooRoutes.orderInfo,
        query: { invoiceinfo: JSON.stringify({ erpcode }) },
    });
    return res.Success;
}
