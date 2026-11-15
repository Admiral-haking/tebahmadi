export type InventoryRow = { stockQuantity: number; reservedQuantity: number };
export type InventoryMovement = {
  variantId: string;
  operation: string;
  quantity: number;
  operationKey: string;
  before: InventoryRow;
  after: InventoryRow;
};
export type InventoryInput = { variantId: string; quantity: number; operationKey: string };
export type InventoryAvailability = InventoryRow & { availableQuantity: number };

export type InventoryStore = {
  read(variantId: string): Promise<InventoryRow | null>;
  write(variantId: string, next: InventoryRow): Promise<InventoryRow>;
  movement(movement: InventoryMovement): Promise<void>;
};

const available = (row: InventoryRow) => Math.max(0, row.stockQuantity - row.reservedQuantity);

export class InventoryService {
  private readonly completed = new Map<string, InventoryAvailability>();

  constructor(private readonly store: InventoryStore) {}

  async getAvailability(variantId: string): Promise<InventoryAvailability> {
    const row = await this.store.read(variantId);
    if (!row) throw new Error("واریانت پیدا نشد");
    return { ...row, availableQuantity: available(row) };
  }

  async reserve(input: InventoryInput): Promise<InventoryAvailability> {
    return this.change(input, "reserve", (row) => {
      if (available(row) < input.quantity) throw new Error("موجودی کافی نیست");
      return { ...row, reservedQuantity: row.reservedQuantity + input.quantity };
    });
  }

  async release(input: InventoryInput): Promise<InventoryAvailability> {
    return this.change(input, "release", (row) => ({
      ...row,
      reservedQuantity: Math.max(0, row.reservedQuantity - input.quantity),
    }));
  }

  async deduct(input: InventoryInput): Promise<InventoryAvailability> {
    return this.change(input, "deduct", (row) => {
      if (row.stockQuantity < input.quantity || row.reservedQuantity < input.quantity) {
        throw new Error("موجودی رزروشده کافی نیست");
      }
      return {
        stockQuantity: row.stockQuantity - input.quantity,
        reservedQuantity: row.reservedQuantity - input.quantity,
      };
    });
  }

  async restore(input: InventoryInput): Promise<InventoryAvailability> {
    return this.change(input, "restore", (row) => ({
      stockQuantity: row.stockQuantity + input.quantity,
      reservedQuantity: Math.max(0, row.reservedQuantity - input.quantity),
    }));
  }

  async receive(input: InventoryInput): Promise<InventoryAvailability> {
    return this.change(input, "receive", (row) => ({ ...row, stockQuantity: row.stockQuantity + input.quantity }));
  }

  async adjust(input: InventoryInput): Promise<InventoryAvailability> {
    return this.change(input, "adjustment", (row) => {
      const nextStock = row.stockQuantity + input.quantity;
      if (nextStock < row.reservedQuantity || nextStock < 0) throw new Error("موجودی جدید از رزروها کمتر است");
      return { ...row, stockQuantity: nextStock };
    });
  }

  private async change(
    input: InventoryInput,
    operation: string,
    nextRow: (row: InventoryRow) => InventoryRow,
  ): Promise<InventoryAvailability> {
    if (!input.variantId || !input.operationKey || !Number.isSafeInteger(input.quantity) || input.quantity <= 0) {
      throw new Error("اطلاعات گردش موجودی معتبر نیست");
    }
    const prior = this.completed.get(input.operationKey);
    if (prior) return prior;
    const row = await this.store.read(input.variantId);
    if (!row) throw new Error("واریانت پیدا نشد");
    const next = nextRow(row);
    if (next.stockQuantity < 0 || next.reservedQuantity < 0 || next.reservedQuantity > next.stockQuantity) {
      throw new Error("موجودی نامعتبر است");
    }
    const persisted = await this.store.write(input.variantId, next);
    const result = { ...persisted, availableQuantity: available(persisted) };
    await this.store.movement({ variantId: input.variantId, operation, quantity: input.quantity, operationKey: input.operationKey, before: row, after: persisted });
    this.completed.set(input.operationKey, result);
    return result;
  }
}
