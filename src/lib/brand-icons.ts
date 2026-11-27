export const BRAND_ICON_NAMES = [
  "category",
  "home",
  "herbs",
  "tea",
  "oils",
  "honey",
  "distillate",
  "spices",
  "shipping",
  "authenticity",
  "support",
  "payment",
  "store",
  "cart",
  "account",
  "orders",
  "logout",
  "search",
  "menu",
  "info",
] as const;

export type BrandIconName = (typeof BRAND_ICON_NAMES)[number];

const legacyCategoryAliases = new Map<string, BrandIconName>([
  ["leaf", "herbs"],
  ["herbs", "herbs"],
  ["herb", "herbs"],
  ["cup", "tea"],
  ["tea", "tea"],
  ["droplet", "oils"],
  ["drop", "oils"],
  ["oil", "oils"],
  ["sun", "honey"],
  ["honey", "honey"],
  ["flask", "distillate"],
  ["distillate", "distillate"],
  ["sparkles", "spices"],
  ["spice", "spices"],
]);

function normalize(value: unknown): string {
  return typeof value === "string"
    ? value
        .toLocaleLowerCase("fa-IR")
        .replace(/[\u200c\u200f\u202a-\u202e_-]+/g, " ")
        .trim()
    : "";
}

function categoryTokens(value: string): string[] {
  return value.split(/[\s/]+/).filter(Boolean);
}

function hasCategoryToken(tokens: Set<string>, ...matches: string[]): boolean {
  return matches.some((match) => Array.from(tokens).some((token) => token === match || token.startsWith(match)));
}

/** Resolve the brand category icon from category copy, path, or legacy preview keys. */
export function resolveBrandIconName(...values: unknown[]): BrandIconName {
  const normalizedValues = values.map(normalize).filter(Boolean);
  const tokens = new Set(normalizedValues.flatMap(categoryTokens));

  const alias = normalizedValues.map((value) => legacyCategoryAliases.get(value)).find((value): value is BrandIconName => Boolean(value));
  if (alias) return alias;

  if (hasCategoryToken(tokens, "دمنوش", "چای", "tea", "teas", "cup")) return "tea";
  if (hasCategoryToken(tokens, "روغن", "oil", "oils", "drop", "droplet")) return "oils";
  if (hasCategoryToken(tokens, "عسل", "بره", "موم", "گرده", "honey")) return "honey";
  if (hasCategoryToken(tokens, "عرق", "گلاب", "تقطیر", "distill", "distillate", "flask")) return "distillate";
  if (hasCategoryToken(tokens, "زعفران", "ادویه", "saffron", "spice", "spices", "sparkles")) return "spices";
  if (hasCategoryToken(tokens, "گیاه", "دارویی", "herb", "herbal", "herbs", "medicinal", "leaf", "spa")) return "herbs";

  return "category";
}
