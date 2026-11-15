export type ExistingShipment = { status?: string | null; trackingCode?: string | null };
export type ShipmentClaimDecision = "claim" | "idempotent" | "busy" | "retry";

export type NormalizedShipmentStatus = "pending" | "registered" | "in_transit" | "delivered" | "failed" | "cancelled";

export function normalizeShipmentStatus(status: unknown): NormalizedShipmentStatus {
  const value = String(status ?? "").toLowerCase();
  if (["delivered", "delivery", "تحویل", "7"].includes(value)) return "delivered";
  if (["failed", "failure", "error", "خطا", "3", "4", "6", "8", "9", "18", "81"].includes(value)) return "failed";
  if (["cancelled", "canceled", "cancel", "لغو", "لغوشده", "11", "80", "83", "102"].includes(value)) return "cancelled";
  if (["in_transit", "in-transit", "transit", "shipped", "در مسیر", "ارسال شده", "13", "14", "15", "16", "17", "50"].includes(value)) return "in_transit";
  if (["pending", "processing", "درحال پردازش", "-100", "-1", "0", "100", "101", "103"].includes(value)) return "pending";
  return "registered";
}

export function shipmentClaimDecision(existing: ExistingShipment | null): ShipmentClaimDecision {
  if (!existing) return "claim";
  if (existing.trackingCode || ["registered", "delivered"].includes(String(existing.status))) return "idempotent";
  if (String(existing.status) === "pending") return "busy";
  return "retry";
}
