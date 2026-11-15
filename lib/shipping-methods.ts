export type ShippingMethodInput = {
  code: string;
  title: string;
  provider: string;
  priceToman: number;
  freeOverToman: number | null;
  etaDays: number;
  pricingJson: string;
  settingsJson: string;
  active: boolean;
};

const safeCode = /^[a-z0-9][a-z0-9_-]{1,48}$/;

export function normalizeShippingMethod(input: Record<string, unknown>): ShippingMethodInput | null {
  const code = String(input.code ?? "").trim().toLowerCase();
  const title = String(input.title ?? "").trim().slice(0, 120);
  const provider = String(input.provider ?? "manual").trim().toLowerCase().slice(0, 40) || "manual";
  const priceToman = Math.floor(Number(input.priceToman));
  const freeRaw = input.freeOverToman === "" || input.freeOverToman == null ? null : Math.floor(Number(input.freeOverToman));
  const etaDays = Math.floor(Number(input.etaDays ?? 3));
  const pricingJson = typeof input.pricingJson === "string" ? input.pricingJson.slice(0, 6000) : "[]";
  const settingsJson = typeof input.settingsJson === "string" ? input.settingsJson.slice(0, 6000) : "{}";
  if (!safeCode.test(code) || title.length < 2 || !Number.isSafeInteger(priceToman) || priceToman < 0 ||
      freeRaw !== null && (!Number.isSafeInteger(freeRaw) || freeRaw < 0) || !Number.isSafeInteger(etaDays) || etaDays < 1 || etaDays > 60) return null;
  try {
    const pricing = JSON.parse(pricingJson), settings = JSON.parse(settingsJson);
    if (!Array.isArray(pricing) || !settings || typeof settings !== "object" || Array.isArray(settings)) return null;
  } catch { return null; }
  return { code, title, provider, priceToman, freeOverToman: freeRaw, etaDays, pricingJson, settingsJson, active: input.active !== false };
}
