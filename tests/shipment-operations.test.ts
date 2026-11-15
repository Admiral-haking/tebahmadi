import test from "node:test";
import assert from "node:assert/strict";
import { normalizeShipmentStatus, shipmentClaimDecision } from "../lib/shipment-operations";

test("shipmentClaimDecision blocks pending work, reuses registered work, and retries failures", () => {
  assert.equal(shipmentClaimDecision(null), "claim");
  assert.equal(shipmentClaimDecision({ status: "registered", trackingCode: "TRK" }), "idempotent");
  assert.equal(shipmentClaimDecision({ status: "pending", trackingCode: null }), "busy");
  assert.equal(shipmentClaimDecision({ status: "failed", trackingCode: null }), "retry");
});

test("normalizeShipmentStatus maps provider values to store states", () => {
  assert.equal(normalizeShipmentStatus(7), "delivered");
  assert.equal(normalizeShipmentStatus(4), "failed");
  assert.equal(normalizeShipmentStatus("error"), "failed");
  assert.equal(normalizeShipmentStatus(0), "pending");
  assert.equal(normalizeShipmentStatus("registered"), "registered");
});

test("normalizeShipmentStatus preserves transit and cancellation states", () => {
  assert.equal(normalizeShipmentStatus("shipped"), "in_transit");
  assert.equal(normalizeShipmentStatus("لغو"), "cancelled");
});
