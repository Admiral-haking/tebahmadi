import { DgkVariantsResponse } from "@/digikala/services/products";
import { Get } from "@/utils/fetch";
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Checkbox,
  IconButton,
  LinearProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import axios from "axios";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import DialogCloseButton from "./dialog-close-button";
import { DGK_SYSTEM_PROMPT } from "../constants/system-prompt";
import { DGK_USER_PROMPT_TEMPLATE } from "../constants/user-prompt-template";
import Orderly from "@/components/orderly";
import { ContentCopyRounded } from "@mui/icons-material";
import { RefreshButton } from "@/components/refresh";
import DgkStockPatchControl from "./stock-patch-control";
import DgkActivationToggle from "./activation-toggle";
import {
  fetchProductImages,
  downloadAndUploadImagesParallel,
  downloadAndUploadImage,
  analyzeImageWithAI,
} from "@/digikala/services/dgk-image-utils";
import useLocalStorage from "@/hooks/use-localStorage";

type IPrefix = {
  name: string;
  prefix: string;
  last: number;
};

const LARGE_VARIANT_COUNT = 20;
const AI_PROMPT_VARIANT_LIMIT = 12;
const GALLERY_IMAGES_NORMAL = 10;
const GALLERY_IMAGES_LARGE = 4;
const VARIANT_IMAGE_CONCURRENCY = 4;
const MAX_AI_EXTRA_IMAGE_UPLOADS = 24;
const DRAFT_KEY_PREFIX = "dgk-import-draft:";
const RESERVED_CODES_PREFIX = "dgk-reserved-codes:";

function uniqueStrings(values: unknown[]): string[] {
  return Array.from(
    new Set(
      values
        .map((value) => (typeof value === "string" ? value.trim() : ""))
        .filter(Boolean),
    ),
  );
}

function cleanImageUrl(value: string): string {
  return value.split("?")[0].split("#")[0].trim();
}

function compactDigikalaVariant(item: any) {
  return {
    product_variant_id: item?.product_variant_id,
    id: item?.id,
    supplier_code: item?.supplier_code,
    title: item?.title,
    price_sale: item?.price_sale,
    marketplace_seller_stock: item?.marketplace_seller_stock,
    image_src: item?.image_src,
  };
}

function clonePlain<T>(value: T): T {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function variantCodeKey(item: any, index: number): string {
  return String(item?.product_variant_id ?? item?.id ?? index);
}

async function copyTextToClipboard(text: string) {
  if (window.navigator.clipboard?.writeText) {
    try {
      await window.navigator.clipboard.writeText(text);
      return;
    } catch {
      // Some browsers reject Clipboard API outside secure contexts; use the legacy fallback below.
    }
  }

  const input = document.createElement("textarea");
  input.value = text;
  input.setAttribute("readonly", "true");
  input.style.position = "fixed";
  input.style.insetInlineStart = "-9999px";
  document.body.appendChild(input);
  input.select();
  const copied = document.execCommand("copy");
  document.body.removeChild(input);
  if (!copied) {
    throw new Error("clipboard_copy_failed");
  }
}

function normalizeGeneratedVariants(
  variants: unknown,
  dgkItems: any[],
): VariantFormValue[] {
  const aiVariants = Array.isArray(variants)
    ? (variants.filter(
        (variant) => variant && typeof variant === "object",
      ) as VariantFormValue[])
    : [];

  const bySku = new Map<string, VariantFormValue>();
  const byBarcode = new Map<string, VariantFormValue>();
  aiVariants.forEach((variant) => {
    const sku = String(variant?.sku ?? "").trim();
    const barcode = String(variant?.barcode ?? "").trim();
    if (sku) bySku.set(sku, variant);
    if (barcode) byBarcode.set(barcode, variant);
  });

  const template = aiVariants[0] ? clonePlain(aiVariants[0]) : undefined;

  return dgkItems.map((item, index) => {
    const dgkSku = String(item?.product_variant_id || item?.id || index + 1);
    const supplierCode =
      typeof item?.supplier_code === "string" ? item.supplier_code.trim() : "";
    const matched =
      bySku.get(dgkSku) ||
      (supplierCode ? byBarcode.get(supplierCode) : undefined) ||
      aiVariants[index] ||
      template ||
      {};
    const base = clonePlain(matched) as VariantFormValue;
    const stock = Number(item?.marketplace_seller_stock ?? 0);
    const priceSale = Number(item?.price_sale ?? 0);

    return {
      ...base,
      sku: dgkSku,
      barcode: supplierCode || base.barcode || dgkSku,
      active: typeof base.active === "boolean" ? base.active : true,
      priceModel: base.priceModel || "fixed",
      priceAmount:
        typeof base.priceAmount === "number" &&
        Number.isFinite(base.priceAmount)
          ? base.priceAmount
          : Number.isFinite(priceSale)
            ? Math.max(0, priceSale)
            : 0,
      priceUnit: base.priceUnit || "unit",
      inventoryTracking: base.inventoryTracking || "unit",
      inventoryQuantity:
        typeof base.inventoryQuantity === "number" &&
        Number.isFinite(base.inventoryQuantity)
          ? base.inventoryQuantity
          : Number.isFinite(stock)
            ? Math.max(0, stock)
            : 0,
      offerEnabled:
        typeof base.offerEnabled === "boolean" ? base.offerEnabled : false,
      offerAmount:
        typeof base.offerAmount === "number" &&
        Number.isFinite(base.offerAmount)
          ? base.offerAmount
          : 0,
      mediaIds: Array.isArray(base.mediaIds) ? base.mediaIds : [],
      attributeValues:
        base.attributeValues && typeof base.attributeValues === "object"
          ? base.attributeValues
          : { weightGrams: 1 },
    };
  });
}

async function uploadImagesByUrl(
  imageUrls: string[],
  concurrency = VARIANT_IMAGE_CONCURRENCY,
): Promise<Map<string, string>> {
  const urls = uniqueStrings(imageUrls.map(cleanImageUrl)).filter(Boolean);
  const result = new Map<string, string>();

  for (let index = 0; index < urls.length; index += concurrency) {
    const chunk = urls.slice(index, index + concurrency);
    const uploaded = await Promise.allSettled(
      chunk.map(
        async (url) => [url, await downloadAndUploadImage(url)] as const,
      ),
    );
    uploaded.forEach((item) => {
      if (item.status === "fulfilled") {
        result.set(item.value[0], item.value[1]);
      }
    });
  }

  return result;
}

function persistImportDraft(
  productId: number | string,
  object: unknown,
): string | null {
  if (typeof window === "undefined") return null;

  try {
    const key = `${DRAFT_KEY_PREFIX}${productId}:${Date.now()}`;
    window.localStorage.setItem(key, JSON.stringify(object));

    Object.keys(window.localStorage)
      .filter((item) => item.startsWith(DRAFT_KEY_PREFIX) && item !== key)
      .slice(0, -4)
      .forEach((item) => window.localStorage.removeItem(item));

    return key;
  } catch (error) {
    console.error("Failed to persist Digikala import draft", error);
    return null;
  }
}
export default function Variant({
  product_id,
  vendorId,
  product,
  categories,
  types,
}: {
  product_id: number;
  vendorId: string;
  product: string;
  categories?: any[];
  types?: any[];
}) {
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<DgkVariantsResponse>();
  const [asking, setAsking] = useState(false);
  const [prefixes, setPrefixes] = useState<IPrefix[]>();
  const [prefixSelected, setPrefixSelected] = useState("");
  const [start, setStart] = useState(0);
  const [includeVariantImagesForAi, setIncludeVariantImagesForAi] =
    useState(true);
  const [variantImageAsPrimary, setVariantImageAsPrimary] = useState(true);
  const [reservedCodes, setReservedCodes] = useState<Record<string, string>>(
    {},
  );
  const [activeCodeKey, setActiveCodeKey] = useState<string>("");
  const codeRowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});
  const [llm] = useLocalStorage("llm")
  // Bulk activation state (operates on the selected variants).
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);
  // Multi-select: set of selected DGK variant ids.
  const [selectedVariants, setSelectedVariants] = useState<Set<number>>(new Set());

  const selectableVariantIds = (response?.data.items ?? [])
    .map((x) => Number(x.product_variant_id || x.id))
    .filter((id) => Number.isFinite(id) && id > 0);
  const allVariantsSelected =
    selectableVariantIds.length > 0 && selectableVariantIds.every((id) => selectedVariants.has(id));
  const someVariantsSelected = selectableVariantIds.some((id) => selectedVariants.has(id));

  function toggleSelectVariant(id: number, checked: boolean) {
    setSelectedVariants((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id); else next.delete(id);
      return next;
    });
  }

  function toggleSelectAllVariants(checked: boolean) {
    setSelectedVariants(checked ? new Set(selectableVariantIds) : new Set());
  }

  /** Patch a variant's `active` flag in local state by its DGK variant id. */
  function patchActiveLocal(dgkVariantId: number, active: boolean) {
    setResponse((current) => {
      if (!current) return current;
      return {
        ...current,
        data: {
          ...current.data,
          items: current.data.items.map((item) =>
            Number(item.product_variant_id || item.id) === dgkVariantId
              ? { ...item, active }
              : item,
          ),
        },
      };
    });
  }

  /**
   * Activate or deactivate the SELECTED variants that aren't already in the
   * target state. Runs at most 5 PATCHes concurrently, shows progress, keeps
   * failed rows in their original state, and reports a success/failure summary.
   */
  async function bulkSetActivation(target: boolean) {
    const items = response?.data.items ?? [];
    const todo = items
      .map((x) => ({ id: Number(x.product_variant_id || x.id), active: x.active !== false }))
      .filter(
        (v) =>
          Number.isFinite(v.id) && v.id > 0 &&
          selectedVariants.has(v.id) &&        // only selected
          v.active !== target,                 // skip those already in target state
      );

    if (!todo.length) {
      toast.info(
        target
          ? "واریانت انتخاب‌شده‌ای برای فعال‌سازی نیست (یا همه فعال‌اند)."
          : "واریانت انتخاب‌شده‌ای برای غیرفعال‌سازی نیست (یا همه غیرفعال‌اند).",
      );
      return;
    }

    setBulkBusy(true);
    setBulkProgress({ done: 0, total: todo.length });
    let ok = 0;
    let done = 0;
    const failed: number[] = [];
    const CONCURRENCY = 5;

    async function worker(queue: typeof todo) {
      while (queue.length) {
        const v = queue.shift();
        if (!v) break;
        try {
          await axios.patch("/api/digikala/activation", {
            vendorId,
            dgkVariantId: v.id,
            activation: target,
          });
          patchActiveLocal(v.id, target);
          ok += 1;
        } catch {
          failed.push(v.id); // leave row as-is
        } finally {
          done += 1;
          setBulkProgress({ done, total: todo.length });
        }
      }
    }

    const shared = [...todo];
    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, shared.length) }, () => worker(shared)),
    );

    setBulkBusy(false);
    setBulkProgress(null);
    const verb = target ? "فعال" : "غیرفعال";
    if (failed.length) {
      toast.error(
        `${ok.toLocaleString("fa-IR")} واریانت ${verb} شد. ${failed.length.toLocaleString("fa-IR")} واریانت به دلیل خطا انجام نشد.`,
      );
    } else {
      toast.success(`${ok.toLocaleString("fa-IR")} واریانت با موفقیت ${verb} شد.`);
    }
  }

  const missingCodeItems = useMemo(
    () =>
      response?.data.items.filter(
        (item) => !String(item?.supplier_code ?? "").trim(),
      ) ?? [],
    [response],
  );

  const getReservedCode = (item: any, index: number): string => {
    const reserved = reservedCodes[variantCodeKey(item, index)];
    if (reserved) return reserved;
    return "";
  };

  useEffect(() => {
    if (!activeCodeKey) return;
    codeRowRefs.current[activeCodeKey]?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }, [activeCodeKey]);

  function handleLoadProducts() {
    // Restore reserved codes from session storage (survives dialog close/reopen)
    try {
      const savedKey = `${RESERVED_CODES_PREFIX}${product_id}`;
      const saved = sessionStorage.getItem(savedKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.prefixSelected && parsed?.reservedCodes) {
          setPrefixSelected(parsed.prefixSelected);
          setStart(parsed.start || 0);
          setReservedCodes(parsed.reservedCodes);
          const firstReservedKey = Object.keys(parsed.reservedCodes)[0] ?? "";
          setActiveCodeKey(firstReservedKey);
        }
      }
    } catch {
      // ignore session storage errors
    }
    let remaining = 2;
    function endLoading() { if (--remaining === 0) setLoading(false); }

    setLoading(true);
    Get(`/api/digikala/products/${product_id}?vendorId=${vendorId}`)
      .then((res) => {
        setResponse(res);
        const items = Array.isArray(res?.data?.items) ? res.data.items : [];
        // Check if we restored data from sessionStorage
        const hasSessionData = (() => {
          try {
            const saveKey = `${RESERVED_CODES_PREFIX}${product_id}`;
            const saved = sessionStorage.getItem(saveKey);
            if (!saved) return false;
            const parsed = JSON.parse(saved);
            return (
              parsed?.prefixSelected &&
              parsed?.reservedCodes &&
              Object.keys(parsed.reservedCodes).length > 0
            );
          } catch {
            return false;
          }
        })();
        if (!hasSessionData) {
          setReservedCodes({});
          setActiveCodeKey("");
          setStart(0);
          setPrefixSelected(
            items.length > 0 &&
              items.every((item: any) =>
                String(item?.supplier_code ?? "").trim(),
              )
              ? "__existing__"
              : "",
          );
        } else {
          // Apply session codes to the response items
          try {
            const saveKey = `${RESERVED_CODES_PREFIX}${product_id}`;
            const saved = sessionStorage.getItem(saveKey);
            if (saved) {
              const parsed = JSON.parse(saved);
              if (parsed.prefixSelected)
                setPrefixSelected(parsed.prefixSelected);
              if (parsed.start) setStart(parsed.start);
              if (parsed.reservedCodes) {
                setReservedCodes(parsed.reservedCodes);
                setActiveCodeKey(Object.keys(parsed.reservedCodes)[0] ?? "");
              }
            }
          } catch {}
        }
      })
      .catch(() => toast.error("خطا در بارگیری واریانت‌های دیجی‌کالا"))
      .finally(endLoading);

    axios
      .get("/api/barcode")
      .then((res) => setPrefixes(res.data))
      .catch(() => {
        toast.error("خطا در بارگیری کدهای حسابداری");
        setPrefixes([]);
      })
      .finally(endLoading);
  }

  async function handleTalkToDeepseek(
    selectedType: string,
    selectedId: string,
  ) {
    if (!response?.data.items)
      return toast.error("واریانت‌های دیجی‌کالا بارگیری نشده‌اند.");
    const digikalaItems = response.data.items.map((item, index) => ({
      ...item,
      supplier_code:
        String(item?.supplier_code ?? "").trim() ||
        getReservedCode(item, index),
    }));
    if (digikalaItems.some((x) => !x.supplier_code))
      return toast.error(
        "برای همه واریانت‌ها کد حسابداری رزرو یا ثبت نشده است.",
        { duration: 2e4 },
      );
    const largeImport = digikalaItems.length >= LARGE_VARIANT_COUNT;
    const variantsForPrompt = largeImport
      ? digikalaItems.slice(0, AI_PROMPT_VARIANT_LIMIT)
      : digikalaItems;
    if (largeImport) {
      toast.info(
        "محصول پرتعداد است؛ روی نمونه واریانت پردازش می‌شود و بقیه خودکار تکمیل می‌گردد.",
      );
    }
    setAsking(true);

    // Step 1: Fetch all product gallery images from Digikala
    let galleryImageUrls: string[] = [];
    const imageAnalysisResults: string[] = [];
    try {
      toast.info("در حال دریافت تصاویر محصول از دیجی‌کالا...");
      const productImages = await fetchProductImages(product_id);
      galleryImageUrls = uniqueStrings(productImages.gallery || []);

      if (galleryImageUrls.length > 0) {
        toast.success(
          `${galleryImageUrls.length} تصویر از گالری محصول دریافت شد`,
        );
        const variantImagesToAnalyze = includeVariantImagesForAi
          ? uniqueStrings(
              digikalaItems.map((v) => v.image_src).filter(Boolean),
            ).slice(0, largeImport ? 4 : 10)
          : [];
        const imagesToAnalyze = uniqueStrings([
          ...galleryImageUrls.slice(0, largeImport ? 2 : 3),
          ...variantImagesToAnalyze,
        ]).slice(0, largeImport ? 6 : 12);
        // Analyze all images in parallel for faster loading
        const analysisPromises = imagesToAnalyze.map(async (imgUrl) => {
          try {
            return await analyzeImageWithAI(imgUrl);
          } catch {
            return null;
          }
        });
        const analysisResults = await Promise.all(analysisPromises);
        analysisResults.forEach((analysis) => {
          if (analysis) imageAnalysisResults.push(analysis);
        });
      }
    } catch (error) {
      console.error("Failed to fetch product images:", error);
      toast.warning(
        "نتونستم تصاویر محصول رو از دیجی‌کالا بگیرم، اما ادامه میدم...",
      );
    }

    const galleryImagesForPrompt = galleryImageUrls.slice(
      0,
      largeImport ? GALLERY_IMAGES_LARGE : GALLERY_IMAGES_NORMAL,
    );
    const allVariantImageUrls = includeVariantImagesForAi
      ? uniqueStrings(digikalaItems.map((v) => v.image_src).filter(Boolean))
      : [];
    const variantImagesForPrompt = allVariantImageUrls.slice(
      0,
      largeImport ? 20 : 60,
    );
    const allProductImages = [
      ...new Set([...galleryImagesForPrompt, ...variantImagesForPrompt]),
    ];

    let enhancedPrompt = DGK_USER_PROMPT_TEMPLATE.replace(
      "{{productJson}}",
      product,
    )
      .replace(
        "{{variantsJson}}",
        JSON.stringify(variantsForPrompt.map(compactDigikalaVariant)),
      )
      .replace("{{productTypeAttributesJson}}", selectedType)
      .replace("{{categoriesJson}}", JSON.stringify(categories));

    if (imageAnalysisResults.length > 0) {
      enhancedPrompt += `\n\nPRODUCT IMAGE ANALYSIS (AI vision analysis of product photos):\n${imageAnalysisResults.join("\n---\n")}\n\nUse this visual analysis to better understand the product's material, color, style, and features for generating accurate attribute values and descriptions.`;
    }

    if (allProductImages.length > 0) {
      enhancedPrompt += `\n\nPRODUCT GALLERY IMAGES (all available product images):\n${allProductImages.join("\n")}\n\nFor each variant, include ALL relevant gallery image URLs in its mediaIds array along with the variant's own image_src.`;
    }

    try {
      const aiResponse = await axios.post(llm || "/api/ai/extract", {
        model: "deepseek-chat",
        messages: [
          { role: "system", content: DGK_SYSTEM_PROMPT },
          { role: "user", content: enhancedPrompt },
        ],
        temperature: 0,
        response_format: { type: "json_object" },
      });

      const object = JSON.parse(aiResponse.data.choices[0].message.content);
      object.productTypeId = selectedId;

      const slugPrefix = String(product_id);
      const toEnglishDigits = (value: string) =>
        value
          .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
          .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));

      const faToLatinMap: Record<string, string> = {
        ا: "a",
        آ: "a",
        أ: "a",
        إ: "e",
        ء: "",
        ئ: "y",
        ؤ: "v",
        ب: "b",
        پ: "p",
        ت: "t",
        ث: "s",
        ج: "j",
        چ: "ch",
        ح: "h",
        خ: "kh",
        د: "d",
        ذ: "z",
        ر: "r",
        ز: "z",
        ژ: "zh",
        س: "s",
        ش: "sh",
        ص: "s",
        ض: "z",
        ط: "t",
        ظ: "z",
        ع: "a",
        غ: "gh",
        ف: "f",
        ق: "q",
        ک: "k",
        ك: "k",
        گ: "g",
        ل: "l",
        م: "m",
        ن: "n",
        و: "v",
        ه: "h",
        ة: "h",
        ی: "y",
        ي: "y",
        ى: "y",
      };

      const transliteratedSlugSource = Array.from(
        toEnglishDigits(String(object?.slug ?? object?.title ?? "")),
      )
        .map((char) => faToLatinMap[char] ?? char)
        .join("");

      const normalizedSlugToken = transliteratedSlugSource
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-+|-+$/g, "");

      const safeSlugToken = normalizedSlugToken || slugPrefix;
      object.slug =
        safeSlugToken === slugPrefix ||
        safeSlugToken.startsWith(slugPrefix + "-")
          ? safeSlugToken
          : slugPrefix + "-" + safeSlugToken;

      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(object.slug)) {
        object.slug = slugPrefix;
      }

      const categoryOptions = (Array.isArray(categories) ? categories : [])
        .map((category: any) => ({
          id: String(category?.id ?? category?._id ?? "").trim(),
          name: String(category?.name ?? "").trim(),
          path: String(category?.path ?? category?.name ?? "").trim(),
        }))
        .filter((category: any) => /^[0-9a-fA-F]{24}$/.test(category.id));

      const aiCategories = Array.isArray(object?.categories)
        ? object.categories
        : object?.categories == null
          ? []
          : [object.categories];

      const mappedCategories = aiCategories
        .map((item: unknown) => String(item ?? "").trim())
        .map((value: string) => {
          if (!value) return "";
          const exactId = categoryOptions.find(
            (category: any) => category.id === value,
          );
          if (exactId) return exactId.id;

          const lower = value.toLowerCase();

          const exactPath = categoryOptions.find(
            (category: any) => category.path.toLowerCase() === lower,
          );
          if (exactPath) return exactPath.id;

          const exactName = categoryOptions.find(
            (category: any) => category.name.toLowerCase() === lower,
          );
          if (exactName) return exactName.id;

          const pathMatch = categoryOptions.find(
            (category: any) =>
              category.path.toLowerCase().includes(lower) ||
              lower.includes(category.path.toLowerCase()),
          );
          if (pathMatch) return pathMatch.id;

          const nameMatch = categoryOptions.find(
            (category: any) =>
              category.name.toLowerCase().includes(lower) ||
              lower.includes(category.name.toLowerCase()),
          );
          if (nameMatch) return nameMatch.id;

          return "";
        })
        .filter((id: string) => !!id);

      object.categories = Array.from(new Set(mappedCategories));
      if (!object.categories.length && categoryOptions.length) {
        object.categories = [categoryOptions[0].id];
      }

      object.dgkImport = {
        vendorId,
        productId: product_id,
        variants: digikalaItems.map((item) => ({
          product_variant_id: item.product_variant_id,
          product_id: item.product_id,
          supplier_code: item.supplier_code,
          marketplace_seller_stock: item.marketplace_seller_stock,
          price_sale: item.price_sale,
          title: item.title,
        })),
      };

      // Apply form validation rules to AI-generated data
      object.variants = normalizeGeneratedVariants(
        object.variants,
        digikalaItems,
      );
      for (let vi = 0; vi < object.variants.length; vi++) {
        const v = object.variants[vi];
        const dgkVariant = digikalaItems[vi];
        if (dgkVariant) {
          v.sku = String(
            dgkVariant.product_variant_id || dgkVariant.id || v.sku || vi + 1,
          );
          v.barcode = dgkVariant.supplier_code || v.barcode;
          v.active = dgkVariant.active !== false;
        }
        if (!v.sku || typeof v.sku !== "string") v.sku = String(vi + 1);
        if (typeof v.priceAmount !== "number" || isNaN(v.priceAmount))
          v.priceAmount = 0;
        if (
          typeof v.inventoryQuantity !== "number" ||
          isNaN(v.inventoryQuantity)
        )
          v.inventoryQuantity = 0;
        if (!v.inventoryTracking) v.inventoryTracking = "unit";
        if (!v.priceUnit) v.priceUnit = "unit";
        if (typeof v.active !== "boolean") v.active = true;
        if (
          v.offerEnabled &&
          (typeof v.offerAmount !== "number" || isNaN(v.offerAmount))
        )
          v.offerAmount = 0;
        if (!v.attributeValues || typeof v.attributeValues !== "object")
          v.attributeValues = {};
        if (
          typeof v.attributeValues.weightGrams !== "number" ||
          v.attributeValues.weightGrams <= 0
        )
          v.attributeValues.weightGrams = 1;
        // Fix color values - ensure they are strings, not objects
        for (const attrKey of Object.keys(v.attributeValues)) {
          if (
            v.attributeValues[attrKey] &&
            typeof v.attributeValues[attrKey] === "object"
          ) {
            const obj = v.attributeValues[attrKey];
            v.attributeValues[attrKey] = obj.key || obj.name || String(obj);
          }
        }
      }

      // Step 3: Process all images using server-side API (no CORS issues)
      toast.info(
        largeImport
          ? "در حال آپلود فشرده تصاویر محصول پرتعداد..."
          : "در حال آپلود تصاویر محصول...",
      );

      const galleryLimit = largeImport
        ? GALLERY_IMAGES_LARGE
        : GALLERY_IMAGES_NORMAL;
      const galleryForUpload = galleryImageUrls.slice(0, galleryLimit);
      const uploadedGalleryMediaIds =
        galleryForUpload.length > 0
          ? await downloadAndUploadImagesParallel(
              galleryForUpload,
              VARIANT_IMAGE_CONCURRENCY,
            )
          : [];
      if (uploadedGalleryMediaIds.length > 0) {
        toast.success(`${uploadedGalleryMediaIds.length} تصویر گالری آپلود شد`);
      }

      const variantImageMediaMap = await uploadImagesByUrl(
        allVariantImageUrls,
        VARIANT_IMAGE_CONCURRENCY,
      );
      const aiExtraImageUrls = largeImport
        ? []
        : uniqueStrings(
            object.variants
              .flatMap((variant: VariantFormValue) =>
                Array.isArray(variant.mediaIds) ? variant.mediaIds : [],
              )
              .filter(
                (address: string) =>
                  address && !/^[0-9a-fA-F]{24}$/.test(address),
              )
              .filter(
                (address: string) =>
                  !address.includes("digikala") &&
                  !address.includes("dkstatics"),
              ),
          ).slice(0, MAX_AI_EXTRA_IMAGE_UPLOADS);
      const aiExtraImageMediaMap = aiExtraImageUrls.length
        ? await uploadImagesByUrl(aiExtraImageUrls, VARIANT_IMAGE_CONCURRENCY)
        : new Map<string, string>();

      // Process each variant's image references without serial network waits per variant.
      for (let index = 0; index < object.variants.length; index++) {
        const e = object.variants[index] as VariantFormValue;

        e.priceAmount = (e.priceAmount || 0) / 10;
        e.offerAmount = (e.offerAmount || 0) / 10;

        if (!e.priceUnit || !UNIT_OPTIONS.find((x) => x.value === e.priceUnit))
          e.priceUnit = "unit";
        if (
          !e.inventoryTracking ||
          !UNIT_OPTIONS.find((x) => x.value === e.inventoryTracking)
        )
          e.inventoryTracking = "unit";

        if (!e.attributeValues) e.attributeValues = {};
        if (
          typeof e.attributeValues.weightGrams !== "number" ||
          e.attributeValues.weightGrams <= 0
        )
          e.attributeValues.weightGrams = 1;

        const images = Array.isArray(e.mediaIds) ? e.mediaIds : [];
        e.mediaIds = [];

        const variantItem = digikalaItems[index];
        const variantImageUrl = variantItem?.image_src
          ? cleanImageUrl(variantItem.image_src)
          : "";
        const variantMediaId = variantImageUrl
          ? variantImageMediaMap.get(variantImageUrl)
          : undefined;
        if (variantMediaId) e.mediaIds.push(variantMediaId);

        if (uploadedGalleryMediaIds.length > 0) {
          e.mediaIds.push(...uploadedGalleryMediaIds);
        }

        if (!largeImport && images.length > 0) {
          for (const address of images.slice(0, 3)) {
            if (/^[0-9a-fA-F]{24}$/.test(address)) {
              e.mediaIds.push(address);
              continue;
            }
            const mediaId = aiExtraImageMediaMap.get(cleanImageUrl(address));
            if (mediaId) e.mediaIds.push(mediaId);
          }
        }

        e.mediaIds = Array.from(new Set(e.mediaIds)).slice(
          0,
          largeImport ? 6 : 12,
        );
      }

      const draftKey = persistImportDraft(product_id, object);
      const serialized = JSON.stringify(object);
      if (draftKey) {
        window.open(
          `/admin/catalog/products/save?draft=${encodeURIComponent(draftKey)}`,
          "_blank",
        );
        toast.success("محصول با تمام تصاویر آماده شد!");
      } else if (serialized.length < 1800) {
        window.open(
          `/admin/catalog/products/save?obj=${encodeURIComponent(serialized)}`,
          "_blank",
        );
        toast.success("محصول با تمام تصاویر آماده شد!");
      } else {
        toast.error(
          "حجم محصول زیاد است و مرورگر نتوانست پیش‌نویس ایمپورت را نگه دارد.",
        );
      }
    } catch (error) {
      console.error("AI extraction failed:", error);
      toast.error("خطا در تبدیل کردن جزئیات کالا.");
    } finally {
      setAsking(false);
    }
  }

  useEffect(handleLoadProducts, []);

  function persistReservedCodes(
    nextReservedCodes: Record<string, string>,
    prefix = prefixSelected,
    nextStart = start,
  ) {
    try {
      const saveKey = `${RESERVED_CODES_PREFIX}${product_id}`;
      sessionStorage.setItem(
        saveKey,
        JSON.stringify({
          prefixSelected: prefix,
          start: nextStart,
          reservedCodes: nextReservedCodes,
        }),
      );
    } catch {}
  }

  async function handleCopyAccountingCode(
    item: any,
    index: number,
    accountingCode: string,
  ) {
    if (!accountingCode) return;

    try {
      await copyTextToClipboard(accountingCode);

      // Codes are reserved in bulk up front, so copying just marks this row's
      // seller code and advances to the next variant still awaiting a copy.
      const updatedItems = (response?.data.items ?? []).map((row, idx) =>
        idx === index ? { ...row, supplier_code: accountingCode } : row,
      );
      const nextItemIndex = updatedItems.findIndex(
        (row, idx) => idx > index && !String(row?.supplier_code ?? "").trim(),
      );
      const nextActiveKey =
        nextItemIndex >= 0
          ? variantCodeKey(updatedItems[nextItemIndex], nextItemIndex)
          : "";

      setResponse((current) => {
        if (!current) return current;
        return {
          ...current,
          data: {
            ...current.data,
            items: current.data.items.map((row, idx) =>
              idx === index ? { ...row, supplier_code: accountingCode } : row,
            ),
          },
        };
      });

      setReservedCodes((prev) => {
        const next = { ...prev };
        delete next[variantCodeKey(item, index)];
        persistReservedCodes(next, prefixSelected, start);
        return next;
      });
      setActiveCodeKey(nextActiveKey);

      toast.success("کد " + accountingCode + " کپی شد.");
    } catch {
      toast.error("کپی کد انجام نشد.");
    }
  }

  return (
    <>
      {loading && <LinearProgress />}
      {!!prefixSelected && (response?.data.items.length ?? 0) > 0 && (
        <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 1, flexWrap: "wrap" }}>
          <Typography variant="caption" color="text.secondary">
            {selectedVariants.size > 0
              ? `${selectedVariants.size.toLocaleString("fa-IR")} واریانت انتخاب شده`
              : "واریانت‌ها را انتخاب کنید"}
          </Typography>
          <Button
            size="small"
            variant="outlined"
            color="success"
            disabled={bulkBusy || !vendorId || selectedVariants.size === 0}
            onClick={() => bulkSetActivation(true)}
          >
            فعال‌سازی انتخاب‌شده
          </Button>
          <Button
            size="small"
            variant="outlined"
            color="warning"
            disabled={bulkBusy || !vendorId || selectedVariants.size === 0}
            onClick={() => bulkSetActivation(false)}
          >
            غیرفعال‌سازی انتخاب‌شده
          </Button>
          {selectedVariants.size > 0 && !bulkBusy && (
            <Button size="small" variant="text" onClick={() => setSelectedVariants(new Set())}>
              لغو انتخاب
            </Button>
          )}
          {bulkProgress && (
            <Stack direction="row" alignItems="center" gap={1} sx={{ minWidth: 160, flex: 1 }}>
              <Box flex={1}>
                <LinearProgress
                  variant="determinate"
                  value={bulkProgress.total ? Math.round((bulkProgress.done / bulkProgress.total) * 100) : 0}
                />
              </Box>
              <Typography variant="caption" color="text.secondary">
                {bulkProgress.done.toLocaleString("fa-IR")}/{bulkProgress.total.toLocaleString("fa-IR")}
              </Typography>
            </Stack>
          )}
        </Stack>
      )}
      {!!prefixSelected ? (
        <TableContainer
          sx={{
            width: "100%",
            overflowX: "auto",
            border: 1,
            borderColor: "divider",
            borderRadius: 1,
          }}
        >
          <Table
            sx={{
              width: "100%",
              tableLayout: "fixed",
              "& th, & td": {
                whiteSpace: "normal",
                overflowWrap: "anywhere",
                wordBreak: "break-word",
                verticalAlign: "top",
              },
            }}
          >
            <TableHead>
              <TableRow>
                <TableCell width={48} padding="checkbox">
                  <Checkbox
                    size="small"
                    checked={allVariantsSelected}
                    indeterminate={!allVariantsSelected && someVariantsSelected}
                    onChange={(e) => toggleSelectAllVariants(e.target.checked)}
                    disabled={bulkBusy}
                  />
                </TableCell>
                <TableCell width={72}>#</TableCell>
                <TableCell width="45%">نام تنوع</TableCell>
                <TableCell width="17%">قیمت</TableCell>
                <TableCell width="18%">وضعیت دیجی‌کالا</TableCell>
                <TableCell width="20%">موجودی</TableCell>
                <TableCell width="25%">کد فروشنده</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {response?.data.items.map((x, i) => {
                const accountingCode = getReservedCode(x, i);
                const codeKey = variantCodeKey(x, i);
                const isActiveCodeRow = Boolean(accountingCode) && activeCodeKey === codeKey;
                return (
                  <TableRow
                    key={x.id}
                    ref={(node) => {
                      codeRowRefs.current[codeKey] = node;
                    }}
                    sx={{
                      bgcolor: isActiveCodeRow ? "rgba(var(--mui-palette-success-mainChannel) / 0.08)" : undefined,
                      outline: isActiveCodeRow ? "2px solid rgba(var(--mui-palette-success-mainChannel) / 0.35)" : undefined,
                      outlineOffset: isActiveCodeRow ? -2 : undefined,
                      transition: "background-color 180ms ease, outline-color 180ms ease",
                    }}
                  >
                    <TableCell padding="checkbox">
                      {(() => {
                        const vId = Number(x.product_variant_id || x.id);
                        return Number.isFinite(vId) && vId > 0 ? (
                          <Checkbox
                            size="small"
                            checked={selectedVariants.has(vId)}
                            onChange={(e) => toggleSelectVariant(vId, e.target.checked)}
                            disabled={bulkBusy}
                          />
                        ) : null;
                      })()}
                    </TableCell>
                    <TableCell>{x.id}</TableCell>
                    <TableCell>
                      <Stack direction="row" alignItems="center" gap={1}>
                        <Box
                          component="img"
                          src={x.image_src}
                          width={64}
                          height={64}
                          alt={x.title}
                          sx={{ borderRadius: 0.6 }}
                        />
                        <Stack>
                          <Typography
                            variant="body2"
                            color="text.primary"
                            component={Link}
                            target="_blank"
                            href={`https://seller.digikala.com/pwa/product/${product_id}/variant`}
                          >
                            {x.title}
                          </Typography>
                        </Stack>
                      </Stack>
                    </TableCell>
                    <TableCell>{x.price_sale}</TableCell>
                    <TableCell>
                      <Stack direction="row" gap={0.75} flexWrap="wrap" alignItems="center">
                        <DgkActivationToggle
                          vendorId={vendorId}
                          dgkVariantId={Number(x.product_variant_id || x.id)}
                          active={x.active !== false}
                          disabled={bulkBusy}
                          onChanged={(active) =>
                            patchActiveLocal(Number(x.product_variant_id || x.id), active)
                          }
                        />
                        <Chip
                          size="small"
                          color={
                            Number(x.marketplace_seller_stock) > 0
                              ? "success"
                              : "error"
                          }
                          variant={
                            Number(x.marketplace_seller_stock) > 0
                              ? "outlined"
                              : "filled"
                          }
                          label={
                            Number(x.marketplace_seller_stock) > 0
                              ? "موجود"
                              : "موجودی صفر"
                          }
                        />
                        <Button
                          size="small"
                          component={Link}
                          target="_blank"
                          href={`https://seller.digikala.com/pwa/product/${product_id}/variant`}
                        >
                          پنل دیجی‌کالا
                        </Button>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Stack gap={0.75}>
                        <Typography variant="caption" color="text.secondary">
                          فعلی:{" "}
                          {Number(
                            x.marketplace_seller_stock ?? 0,
                          ).toLocaleString("fa-IR")}
                        </Typography>
                        <DgkStockPatchControl
                          vendorId={vendorId}
                          dgkVariantId={Number(x.product_variant_id || x.id)}
                          initialStock={Number(x.marketplace_seller_stock ?? 0)}
                          onUpdated={(stock) => {
                            setResponse((current) => {
                              if (!current) return current;
                              return {
                                ...current,
                                data: {
                                  ...current.data,
                                  items: current.data.items.map((item) =>
                                    Number(
                                      item.product_variant_id || item.id,
                                    ) === Number(x.product_variant_id || x.id)
                                      ? {
                                          ...item,
                                          marketplace_seller_stock: stock,
                                        }
                                      : item,
                                  ),
                                },
                              };
                            });
                          }}
                        />
                      </Stack>
                    </TableCell>
                    <TableCell>
                      {x.supplier_code ? (
                        <Chip color="success" label={x.supplier_code} />
                      ) : (
                        <>
                          <Chip
                            color="warning"
                            variant={isActiveCodeRow ? "filled" : "outlined"}
                            label={accountingCode || "کد رزرو نشده"}
                          />
                          <IconButton
                            color={isActiveCodeRow ? "success" : "default"}
                            disabled={loading || !accountingCode}
                            onClick={() =>
                              void handleCopyAccountingCode(
                                x,
                                i,
                                accountingCode,
                              )
                            }
                          >
                            <ContentCopyRounded />
                          </IconButton>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        <Dialog open maxWidth="xs" fullWidth onClose={() => setPrefixSelected("__existing__")}>
          <DialogTitle sx={{ position: "relative", pr: 6 }}>
            کد حسابداری
            <DialogCloseButton onClose={() => setPrefixSelected("__existing__")} disabled={loading} />
          </DialogTitle>
          <DialogContent>
            <Stack gap={2}>
              <Typography variant="body2" color="text.secondary">
                برای {missingCodeItems.length.toLocaleString("fa-IR")} واریانت
                بدون کد، کد جدید رزرو می‌شود.
              </Typography>
              {prefixes?.map((x) => (
                <Button
                  key={x.prefix}
                  disabled={loading}
                  onClick={async () => {
                    const items = response?.data.items ?? [];
                    const itemsWithoutCode = items.filter(
                      (item) => !String(item?.supplier_code ?? "").trim(),
                    );
                    if (!itemsWithoutCode.length) {
                      setPrefixSelected("__existing__");
                      setReservedCodes({});
                      toast.info("همه واریانت‌ها کد فروشنده دارند.");
                      return;
                    }
                    // Reserve codes for ALL variants without a seller code at once
                    // (bulk) so a multi-variant product doesn't require reserving
                    // one code at a time.
                    setLoading(true);
                    try {
                      const count = itemsWithoutCode.length;
                      const { data } = await axios.patch("/api/barcode", {
                        prefix: x.prefix,
                        inc: count,
                      });
                      const prefixValue = String(data?.prefix || x.prefix);
                      const startValue = Number(data?.start || x.last + 1);
                      const codes: string[] =
                        Array.isArray(data?.codes) && data.codes.length === count
                          ? data.codes.map((code: unknown) => String(code))
                          : Array.from({ length: count }, (_, idx) =>
                              prefixValue +
                              "-" +
                              String(startValue + idx).padStart(6, "0"),
                            );
                      const nextReservedCodes: Record<string, string> = {};
                      itemsWithoutCode.forEach((item, idx) => {
                        nextReservedCodes[
                          variantCodeKey(item, items.indexOf(item))
                        ] = codes[idx];
                      });
                      const firstKey = variantCodeKey(
                        itemsWithoutCode[0],
                        items.indexOf(itemsWithoutCode[0]),
                      );
                      const lastStart = startValue + count - 1;
                      setReservedCodes(nextReservedCodes);
                      setActiveCodeKey(firstKey);
                      setPrefixSelected(prefixValue);
                      setStart(lastStart);
                      try {
                        const saveKey = `${RESERVED_CODES_PREFIX}${product_id}`;
                        sessionStorage.setItem(
                          saveKey,
                          JSON.stringify({
                            prefixSelected: prefixValue,
                            start: lastStart,
                            reservedCodes: nextReservedCodes,
                          }),
                        );
                      } catch {}
                      toast.success(
                        `${count.toLocaleString("fa-IR")} کد فروشنده رزرو شد`,
                      );
                    } catch {
                      toast.error("کد حسابداری رزرو نشد. دوباره تلاش کن.");
                    } finally {
                      setLoading(false);
                    }
                  }}
                >
                  {x.name} ({x.prefix})
                </Button>
              ))}
            </Stack>
          </DialogContent>
        </Dialog>
      )}

      <Stack direction="row" gap={2}>
        <Orderly
          buttonProps={{
            variant: "contained",
            children: "وارد کردن محصول",
            fullWidth: true,
            size: "large",
          }}
          hideFinish
          mountChildrenOnOpen
          title={`نوع محصول را انتخاب کنید`}
        >
          {asking && <LinearProgress />}
          <Stack gap={2}>
            {asking && (
              <Typography
                variant="body2"
                color="text.secondary"
                textAlign="center"
              >
                در حال دریافت و تحلیل تصاویر محصول و تولید اطلاعات...
              </Typography>
            )}
            <Stack
              direction={{ xs: "column", sm: "row" }}
              gap={1}
              flexWrap="wrap"
              sx={{
                p: 1,
                border: 1,
                borderColor: "divider",
                borderRadius: 1,
                bgcolor: "background.default",
              }}
            >
              <FormControlLabel
                control={
                  <Checkbox
                    checked={includeVariantImagesForAi}
                    onChange={(event) =>
                      setIncludeVariantImagesForAi(event.target.checked)
                    }
                  />
                }
                label="استفاده از عکس‌های واریانت در هوش مصنوعی"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={variantImageAsPrimary}
                    onChange={(event) =>
                      setVariantImageAsPrimary(event.target.checked)
                    }
                  />
                }
                label="عکس هر واریانت تصویر اصلی همان واریانت باشد"
              />
            </Stack>
            {types?.map((t) => (
              <Button
                key={t.id || t._id}
                variant="contained"
                fullWidth
                onClick={() =>
                  handleTalkToDeepseek(JSON.stringify(t), t.id || t._id)
                }
                disabled={asking}
              >
                {t.name}
              </Button>
            ))}
          </Stack>
        </Orderly>
        {Object.keys(reservedCodes).length > 0 && (
          <Button
            variant="outlined"
            startIcon={<ContentCopyRounded />}
            onClick={async () => {
              const allCodes = Object.values(reservedCodes).filter(Boolean).join("\n");
              if (!allCodes) return;
              try {
                await copyTextToClipboard(allCodes);
                toast.success(
                  `${Object.keys(reservedCodes).length.toLocaleString("fa-IR")} کد فروشنده کپی شد`,
                );
              } catch {
                toast.error("کپی همه کدها انجام نشد.");
              }
            }}
          >
            کپی همه کدها
          </Button>
        )}
        <RefreshButton onClick={handleLoadProducts} />
      </Stack>
    </>
  );
}

type VariantFormValue = {
  sku: string;
  active: boolean;
  priceModel: "fixed" | "per_unit";
  priceAmount?: number;
  priceUnit?: string;
  inventoryTracking: string;
  inventoryQuantity?: number;
  inventoryLowStock?: number;
  minimumOrderQuantity?: number;
  maximumOrderQuantity?: number;
  barcode?: string;
  offerEnabled: boolean;
  offerAmount?: number;
  offerStartsAt?: string;
  offerEndsAt?: string;
  offerLabel?: string;
  mediaIds: string[];
  attributeValues: Record<string, unknown>;
};

const UNIT_OPTIONS = [
  { value: "unit", label: "عدد" },
  { value: "pair", label: "جفت" },
  { value: "kg", label: "کیلوگرم" },
  { value: "g", label: "گرم" },
  { value: "lb", label: "پوند" },
  { value: "oz", label: "اونس" },
  { value: "l", label: "لیتر" },
  { value: "ml", label: "میلی‌لیتر" },
] as const;
