/**
 * Holoo (هلو) accounting web service integration.
 *
 * Single on-prem connection configured via HOLOO_* env vars. The request client
 * handles login + bearer-token caching and maps Holoo's in-band error codes to
 * a `HolooError`. Import the service functions you need from here.
 */

export { isHolooConfigured, getHolooConfig, HOLOO_CONNECTION_ID } from "./constants/config";
export { HolooError, isHolooError, holooError, HOLOO_ERRORS } from "./constants/errors";
export { holooRoutes } from "./constants/routes";

export { holooLogin, getHolooToken, clearHolooToken, getHolooStatus } from "./services/auth";
export type { HolooStatus } from "./services/auth";
export { holooRequest } from "./services/client";

export {
    listHolooCustomers,
    createHolooCustomer,
    updateHolooCustomer,
} from "./services/customer";
export {
    listHolooProducts,
    createHolooProduct,
    updateHolooProduct,
    batchSyncProductsToHoloo,
} from "./services/product";
export type {
    HolooBatchProductItem,
    HolooBatchItemResult,
    HolooBatchReport,
} from "./services/product";
export {
    listHolooMainGroups,
    listHolooSideGroups,
    listHolooUnits,
} from "./services/base";
export {
    accountingPrefix,
    getPrefixSidegroupMap,
    setPrefixSidegroupMap,
    resolveSidegroupForBarcode,
    PREFIX_MAP_KEY,
} from "./services/subgroup";
export type { PrefixSidegroupMap } from "./services/subgroup";
export {
    listHolooInvoices,
    createHolooInvoice,
    createHolooPreInvoice,
    createHolooOrder,
    getHolooPreInvoiceInfo,
    getHolooOrderInfo,
} from "./services/invoice";
export { createHolooHavaleh, createHolooReceive } from "./services/payment";
export {
    syncInvoiceToHoloo,
    resyncInvoiceToHoloo,
    syncReturnToHoloo,
    syncTrackerToHoloo,
    syncTrackerReturnToHoloo,
    scheduleHolooInvoiceSync,
    scheduleHolooReturnSync,
    scheduleHolooTrackerSync,
    isHolooAutoSyncEnabled,
} from "./services/sync-invoice";
export type { SyncInvoiceResult, SalesChannel } from "./services/sync-invoice";
export {
    getVendorCustomerMap,
    setVendorCustomerMap,
    vendorCustomerKey,
    VENDOR_CUSTOMER_MAP_KEY,
} from "./services/sync-invoice";
export {
    getHolooReport,
    getHolooCash,
    getHolooAccount,
    getHolooSarfasl,
} from "./services/report";

export type * from "./types";
