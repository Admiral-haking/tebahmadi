export type ShippingStatus = "unquoted" | "quoted" | "registered" | "in_transit" | "delivered" | "failed" | "cancelled";

const transitions: Record<ShippingStatus, ShippingStatus[]> = {
  unquoted: ["quoted", "registered", "failed"],
  quoted: ["registered", "failed", "unquoted"],
  registered: ["in_transit", "delivered", "failed", "cancelled"],
  in_transit: ["delivered", "failed"],
  delivered: [],
  failed: ["quoted", "registered", "failed"],
  cancelled: [],
};

export function canTransitionShipping(from: string, to: string): boolean {
  if (from === to) return true;
  return (transitions[from as ShippingStatus] || []).includes(to as ShippingStatus);
}
