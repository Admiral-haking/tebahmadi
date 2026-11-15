import test from "node:test";
import assert from "node:assert/strict";
import { InventoryService } from "../lib/inventory-service";

test("reserves available variant stock and is idempotent", async () => {
  const rows = new Map([['v1', { stockQuantity: 10, reservedQuantity: 2 }]]);
  const movements: Array<{ operationKey: string }> = [];
  const service = new InventoryService({
    read: async (variantId) => rows.get(variantId) ?? null,
    write: async (variantId, next) => { rows.set(variantId, next); return next; },
    movement: async (movement) => { movements.push({ operationKey: movement.operationKey }); },
  });

  const first = await service.reserve({ variantId: "v1", quantity: 3, operationKey: "reserve:order:o1:v1" });
  const second = await service.reserve({ variantId: "v1", quantity: 3, operationKey: "reserve:order:o1:v1" });

  assert.equal(first.availableQuantity, 5);
  assert.deepEqual(second, first);
  assert.deepEqual(rows.get("v1"), { stockQuantity: 10, reservedQuantity: 5 });
  assert.equal(movements.length, 1);
});

test("rejects a reservation that exceeds available stock", async () => {
  const service = new InventoryService({
    read: async () => ({ stockQuantity: 4, reservedQuantity: 3 }),
    write: async () => { throw new Error("must not write"); },
    movement: async () => { throw new Error("must not move"); },
  });

  await assert.rejects(
    service.reserve({ variantId: "v1", quantity: 2, operationKey: "reserve:order:o2:v1" }),
    /موجودی کافی نیست/,
  );
});
