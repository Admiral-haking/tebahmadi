export type ReturnStatus = "requested" | "approved" | "rejected" | "received" | "refunded" | "closed";

const transitions: Record<ReturnStatus, readonly ReturnStatus[]> = {
  requested: ["approved", "rejected"],
  approved: ["received", "closed"],
  rejected: [],
  received: ["refunded", "closed"],
  refunded: [],
  closed: [],
};

export function isReturnStatus(value: unknown): value is ReturnStatus {
  return typeof value === "string" && value in transitions;
}

export function canTransitionReturn(from: unknown, to: unknown): to is ReturnStatus {
  return isReturnStatus(from) && isReturnStatus(to) && transitions[from].includes(to);
}

export function returnRequiresRefundRole(status: ReturnStatus, role: string): boolean {
  return status === "refunded" && !["owner", "admin"].includes(role);
}
