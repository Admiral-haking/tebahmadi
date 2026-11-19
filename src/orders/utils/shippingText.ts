type ShippingTextItem = {
  title?: string | null;
  variantSummary?: string | null;
  quantity?: number | string | null;
};

type ShippingTextInput = {
  customerName?: string | null;
  customerPhone?: string | null;
  postalCode?: string | null;
  state?: string | null;
  city?: string | null;
  address?: string | null;
  houseNumber?: string | null;
  houseUnit?: string | null;
  items?: ShippingTextItem[];
};

function normalizeText(value?: string | null): string {
  return value?.replace(/\s+/g, " ").trim() || "";
}

function formatItemTitle(item: ShippingTextItem): string {
  const title = normalizeText(item.title);
  const variantSummary = normalizeText(item.variantSummary?.replace(/\/ weightGrams: [0-9]+/g, ""));

  if (title && variantSummary && title !== variantSummary) {
    return `${title} ${variantSummary}`;
  }

  return title || variantSummary;
}

function buildShippingCopyLine(input: ShippingTextInput, item?: ShippingTextItem): string {
  const destination = [input.state, input.city].map(normalizeText).filter(Boolean).join(" – ");
  const postalCode = input.postalCode ? `کد پستی ${input.postalCode}` : "";
  const houseNumber = input.houseNumber ? `:پلاک${input.houseNumber}` : "";
  const houseUnit = input.houseUnit ? `:واحد${input.houseUnit}` : "";
  const itemTitle = item ? formatItemTitle(item) : "";
  const quantity = item?.quantity === undefined || item.quantity === null || item.quantity === "" ? "" : `${item.quantity} عدد`;
  const productText = [itemTitle, quantity].filter(Boolean).join(" ");

  return [
    `گیرنده: ${input.customerName || "-"}`,
    destination,
    input.customerPhone || "",
    postalCode,
    input.address || "",
    houseNumber,
    houseUnit,
    productText ? `(${productText})` : "",
  ].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

export function buildShippingCopyText(input: ShippingTextInput): string {
  const items = input.items?.length ? input.items : [undefined];

  return items
    .map((item) => buildShippingCopyLine(input, item))
    .filter(Boolean)
    .join("\n");
}

export async function copyShippingText(input: ShippingTextInput): Promise<void> {
  await navigator.clipboard.writeText(buildShippingCopyText(input));
}
