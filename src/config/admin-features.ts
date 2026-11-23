/**
 * Runtime switches for admin-only integrations.
 *
 * These are deliberately kept in one dependency-free module so the same
 * decision is applied to the menu, server-rendered admin routes, API
 * middleware, and background sync boundaries. The storefront remains
 * unaffected by these switches.
 */
export const ADMIN_FEATURES = {
  digikala: false,
  snapp: false,
  basalaam: false,
  marketplaceHealth: false,
  inventoryComparison: false,
  help: false,
  holoo: false,
} as const;

export type AdminFeature = keyof typeof ADMIN_FEATURES;

const ADMIN_ROUTE_FEATURES: ReadonlyArray<readonly [string, AdminFeature]> = [
  ["/admin/digikala", "digikala"],
  ["/admin/snapp", "snapp"],
  ["/admin/basalaam", "basalaam"],
  ["/admin/marketplace-health", "marketplaceHealth"],
  ["/admin/inventory-comparison", "inventoryComparison"],
  ["/admin/help", "help"],
  ["/admin/holoo", "holoo"],
];

const ADMIN_API_FEATURES: ReadonlyArray<readonly [string, AdminFeature]> = [
  ["/api/digikala", "digikala"],
  ["/api/snapp", "snapp"],
  ["/api/basalaam", "basalaam"],
  ["/api/admin/marketplace-health", "marketplaceHealth"],
  ["/api/admin/inventory-comparison", "inventoryComparison"],
  ["/api/holoo", "holoo"],
];

const MARKETPLACE_INTEGRATION_API_PREFIXES = [
  "/api/marketplace",
  "/api/admin/orders/marketplace-presence",
] as const;

const MARKETPLACE_INTEGRATION_API_PATHS = new Set([
  "/api/sync/stock-to-services",
  "/api/sync/stock-from-services",
  "/api/sync/orders-from-services",
  "/api/marketplace/variant-control",
]);

function matchesPath(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isAdminFeatureEnabled(feature: AdminFeature): boolean {
  return ADMIN_FEATURES[feature];
}

export function disabledAdminFeatureForPath(pathname: string): AdminFeature | null {
  for (const [prefix, feature] of ADMIN_ROUTE_FEATURES) {
    if (matchesPath(pathname, prefix) && !isAdminFeatureEnabled(feature)) return feature;
  }
  return null;
}

export function disabledAdminFeatureForApiPath(pathname: string): AdminFeature | null {
  for (const [prefix, feature] of ADMIN_API_FEATURES) {
    if (matchesPath(pathname, prefix) && !isAdminFeatureEnabled(feature)) return feature;
  }
  return null;
}

export function isDisabledMarketplaceIntegrationApiPath(pathname: string): boolean {
  if (MARKETPLACE_INTEGRATION_API_PATHS.has(pathname)) return true;
  return MARKETPLACE_INTEGRATION_API_PREFIXES.some((prefix) => matchesPath(pathname, prefix));
}

export const MARKETPLACE_INTEGRATIONS_ENABLED =
  ADMIN_FEATURES.digikala || ADMIN_FEATURES.snapp || ADMIN_FEATURES.basalaam;

export const PAYMENT_GATEWAYS_ENABLED = {
  zarinpal: true,
  torob: false,
  digipay: false,
  azkivam: false,
  snapppay: false,
  bajetpay: false,
} as const;

type PaymentGatewayId = keyof typeof PAYMENT_GATEWAYS_ENABLED;

const PAYMENT_CALLBACK_GATEWAY_PREFIXES: ReadonlyArray<readonly [string, PaymentGatewayId]> = [
  ["/api/payments/torob", "torob"],
  ["/api/payments/digipay", "digipay"],
  ["/api/payments/snapppay", "snapppay"],
  ["/api/payments/bajetpay", "bajetpay"],
];

export function disabledPaymentGatewayForApiPath(pathname: string): PaymentGatewayId | null {
  for (const [prefix, gateway] of PAYMENT_CALLBACK_GATEWAY_PREFIXES) {
    if (matchesPath(pathname, prefix) && !PAYMENT_GATEWAYS_ENABLED[gateway]) return gateway;
  }
  return null;
}
