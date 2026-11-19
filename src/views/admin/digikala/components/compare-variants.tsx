import { RefreshButton } from "@/components/refresh";
import { Box, Button, Chip, Dialog, DialogContent, DialogTitle, IconButton, LinearProgress, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from "@mui/material";
import axios from "axios";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { DGK_SYSTEM_PROMPT } from "../constants/system-prompt";
import { DGK_USER_PROMPT_TEMPLATE } from "../constants/user-prompt-template";
import {
    fetchProductImages,
    downloadAndUploadImagesParallel,
    downloadAndUploadImage,
    analyzeImageWithAI
} from "@/digikala/services/dgk-image-utils";
import DgkStockPatchControl from "./stock-patch-control";

type DgkVariantRow = {
    id: number;
    image_src: string;
    product_id: number;
    product_variant_id: number;
    supplier_code: string;
    title: string;
    active: boolean;
    price_sale: number;
    marketplace_seller_stock: number;
    left_consumer: number;
    exists: boolean;
};

type IPrefix = {
    name: string;
    prefix: string;
    last: number;
};

type CompareResponse = {
    product: { id: string; title: string; slug: string; productTypeId: string; variantCount: number } | null;
    variants: DgkVariantRow[];
    missingCount: number;
};

type VariantFormValue = {
    sku: string;
    active: boolean;
    priceModel: 'fixed' | 'per_unit';
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

type Props = {
    vendorId: string;
    productId: number;
    product: string;
    productTitle: string;
    categories?: unknown[];
    types?: any[];
    onImported?: () => void | Promise<void>;
};

const UNIT_OPTIONS = [
    { value: 'unit', label: 'عدد' },
    { value: 'pair', label: 'جفت' },
    { value: 'kg', label: 'کیلوگرم' },
    { value: 'g', label: 'گرم' },
    { value: 'lb', label: 'پوند' },
    { value: 'oz', label: 'اونس' },
    { value: 'l', label: 'لیتر' },
    { value: 'ml', label: 'میلی‌لیتر' },
] as const;

const LARGE_VARIANT_COUNT = 20;
const AI_PROMPT_VARIANT_LIMIT = 12;
const IMAGE_UPLOAD_CONCURRENCY = 4;

function clonePlain<T>(value: T): T {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

function uniqueStrings(values: unknown[]): string[] {
    return Array.from(new Set(
        values
            .map((value) => typeof value === "string" ? value.trim() : "")
            .filter(Boolean),
    ));
}

function cleanImageUrl(value: string): string {
    return value.split("?")[0].split("#")[0].trim();
}

function variantCodeKey(item: DgkVariantRow, index: number): string {
    return String(item.product_variant_id || item.id || index);
}

function normalizeGeneratedVariants(variants: unknown, dgkItems: DgkVariantRow[]): VariantFormValue[] {
    const aiVariants = Array.isArray(variants)
        ? variants.filter((variant) => variant && typeof variant === "object") as VariantFormValue[]
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
        const dgkSku = String(item.product_variant_id || item.id || index + 1);
        const supplierCode = String(item.supplier_code ?? "").trim();
        const matched = bySku.get(dgkSku) || (supplierCode ? byBarcode.get(supplierCode) : undefined) || aiVariants[index] || template || {};
        const base = clonePlain(matched) as VariantFormValue;
        const priceSale = Number(item.price_sale ?? 0);
        const stock = Number(item.marketplace_seller_stock ?? 0);

        return {
            ...base,
            sku: dgkSku,
            active: typeof base.active === "boolean" ? base.active : item.active !== false,
            priceModel: base.priceModel || "fixed",
            priceAmount: typeof base.priceAmount === "number" && Number.isFinite(base.priceAmount)
                ? base.priceAmount
                : (Number.isFinite(priceSale) ? Math.max(0, priceSale) : 0),
            priceUnit: base.priceUnit || "unit",
            inventoryTracking: base.inventoryTracking || "unit",
            inventoryQuantity: typeof base.inventoryQuantity === "number" && Number.isFinite(base.inventoryQuantity)
                ? base.inventoryQuantity
                : (Number.isFinite(stock) ? Math.max(0, stock) : 0),
            barcode: supplierCode || base.barcode || dgkSku,
            offerEnabled: typeof base.offerEnabled === "boolean" ? base.offerEnabled : false,
            offerAmount: typeof base.offerAmount === "number" && Number.isFinite(base.offerAmount) ? base.offerAmount : 0,
            mediaIds: Array.isArray(base.mediaIds) ? base.mediaIds : [],
            attributeValues: base.attributeValues && typeof base.attributeValues === "object"
                ? base.attributeValues
                : { weightGrams: 1 },
        };
    });
}

async function uploadImagesByUrl(imageUrls: string[], concurrency = IMAGE_UPLOAD_CONCURRENCY): Promise<Map<string, string>> {
    const urls = uniqueStrings(imageUrls.map(cleanImageUrl));
    const result = new Map<string, string>();

    for (let index = 0; index < urls.length; index += concurrency) {
        const chunk = urls.slice(index, index + concurrency);
        const uploaded = await Promise.allSettled(
            chunk.map(async (url) => [url, await downloadAndUploadImage(url)] as const),
        );
        uploaded.forEach((item) => {
            if (item.status === "fulfilled") {
                result.set(item.value[0], item.value[1]);
            }
        });
    }

    return result;
}

const RESERVED_CODES_CMP_PREFIX = "dgk-cmp-codes:";

export default function CompareDgkVariants({ vendorId, productId, product, productTitle, categories, types, onImported }: Props) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [importing, setImporting] = useState(false);
    const [response, setResponse] = useState<CompareResponse>();
    const [prefixes, setPrefixes] = useState<IPrefix[]>([]);
    const [reservingCodes, setReservingCodes] = useState(false);

    const missingVariants = useMemo(() => response?.variants.filter((item) => !item.exists) || [], [response]);
    const hasMissingSupplierCode = missingVariants.some((item) => !item.supplier_code);

    function handleLoadCompare() {
        // Restore reserved codes from session storage
        try {
            const savedKey = `${RESERVED_CODES_CMP_PREFIX}${productId}`;
            const saved = sessionStorage.getItem(savedKey);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed?.reservedCodes && Object.keys(parsed.reservedCodes).length > 0) {
                    setResponse((current) => {
                        if (!current) return current;
                        const variants = current.variants.map((item) => {
                            const key = String(item.product_variant_id || item.id);
                            if (parsed.reservedCodes[key]) {
                                return { ...item, supplier_code: parsed.reservedCodes[key] };
                            }
                            return item;
                        });
                        return { ...current, variants };
                    });
                }
            }
        } catch {}
        setLoading(true);
        axios.get<CompareResponse>(`/api/digikala/products/${productId}/compare?vendorId=${vendorId}`)
            .then((res) => setResponse(res.data))
            .catch((err) => toast.error(err?.response?.data?.error || "خطا در مقایسه واریانت های دیجی کالا"))
            .finally(() => setLoading(false));
        axios.get<IPrefix[]>("/api/barcode")
            .then((res) => setPrefixes(Array.isArray(res.data) ? res.data : []))
            .catch(() => setPrefixes([]));
    }

    async function handleReserveMissingCodes(prefix: string) {
        const variantsWithoutCode = missingVariants.filter((item) => !String(item.supplier_code ?? "").trim());
        if (!variantsWithoutCode.length) {
            toast.info("همه واریانت‌های جدید کد فروشنده دارند.");
            return;
        }

        setReservingCodes(true);
        try {
            // Reserve only 1 code at a time to prevent counter increment issues
            const { data } = await axios.patch("/api/barcode", { prefix, inc: 1 });
            const codes = Array.isArray(data?.codes) ? data.codes.map((item: unknown) => String(item)) : [];
            if (!codes.length) {
                throw new Error("reserved_codes_missing");
            }
            const reservedCode = String(codes[0]);

            // Assign the single code to the first variant without supplier code
            setResponse((current) => {
                if (!current) return current;
                const variants = [...current.variants];
                const targetIndex = variants.findIndex((item) => !item.exists && !String(item.supplier_code ?? "").trim());
                if (targetIndex >= 0) {
                    variants[targetIndex] = { ...variants[targetIndex], supplier_code: reservedCode };
                }
                // Persist to sessionStorage
                try {
                    const saveKey = `${RESERVED_CODES_CMP_PREFIX}${productId}`;
                    const reserved: Record<string, string> = {};
                    variants.forEach((item) => {
                        const code = String(item.supplier_code ?? "").trim();
                        if (code) {
                            reserved[String(item.product_variant_id || item.id)] = code;
                        }
                    });
                    sessionStorage.setItem(saveKey, JSON.stringify({ reservedCodes: reserved }));
                } catch {}
                return { ...current, variants };
            });

            // Check if there are still missing codes
            const stillMissing = variantsWithoutCode.length - 1;
            if (stillMissing > 0) {
                toast.success(`کد ${reservedCode} رزرو شد. ${stillMissing.toLocaleString("fa-IR")} واریانت دیگر نیاز به کد دارد.`);
            } else {
                toast.success(`کد ${reservedCode} رزرو شد. همه واریانت‌ها کد دارند.`);
            }
        } catch {
            toast.error("رزرو کد حسابداری برای واریانت‌های جدید انجام نشد.");
        } finally {
            setReservingCodes(false);
        }
    }

    async function handleImportMissing() {
        if (!response?.product) return toast.error("محصول متناظر در دیتابیس پیدا نشد.");
        if (!missingVariants.length) return toast.info("واریانت جدیدی برای وارد کردن وجود ندارد.");
        if (hasMissingSupplierCode) return toast.error("برای وارد کردن، همه واریانت های جدید باید کد فروشنده داشته باشند.");

        const selectedType = types?.find((item) => `${item.id || item._id}` === response.product?.productTypeId);
        if (!selectedType) return toast.error("نوع محصول متناظر پیدا نشد.");

        setImporting(true);
        try {
            // Step 1: Fetch all product gallery images from Digikala
            let galleryImageUrls: string[] = [];
            const imageAnalysisResults: string[] = [];
            try {
                toast.info("در حال دریافت تصاویر محصول از دیجی‌کالا...");
                const productImages = await fetchProductImages(productId);
                galleryImageUrls = productImages.gallery;
                
                if (galleryImageUrls.length > 0) {
                    toast.success(`${galleryImageUrls.length} تصویر از گالری محصول دریافت شد`);
                    const imagesToAnalyze = galleryImageUrls.slice(0, 2);
                    for (const imgUrl of imagesToAnalyze) {
                        try {
                            const analysis = await analyzeImageWithAI(imgUrl);
                            if (analysis) imageAnalysisResults.push(analysis);
                        } catch {}
                    }
                }
            } catch (error) {
                console.error("Failed to fetch product images:", error);
            }

            const largeImport = missingVariants.length >= LARGE_VARIANT_COUNT;
            const variantsForPrompt = largeImport ? missingVariants.slice(0, AI_PROMPT_VARIANT_LIMIT) : missingVariants;
            if (largeImport) {
                toast.info("تعداد واریانت‌های جدید زیاد است؛ AI روی نمونه کار می‌کند و بقیه خودکار تکمیل می‌شوند.");
            }

            // Build enhanced prompt
            let enhancedPrompt = DGK_USER_PROMPT_TEMPLATE
                .replace("{{productJson}}", product)
                .replace("{{variantsJson}}", JSON.stringify(variantsForPrompt))
                .replace("{{productTypeAttributesJson}}", JSON.stringify(selectedType))
                .replace("{{categoriesJson}}", JSON.stringify(categories));

            if (imageAnalysisResults.length > 0) {
                enhancedPrompt += `\n\nPRODUCT IMAGE ANALYSIS (AI vision analysis):\n${imageAnalysisResults.join('\n---\n')}\nUse this for better attribute and description generation.`;
            }

            const allImageUrls = [...new Set([...galleryImageUrls, ...missingVariants.map(v => v.image_src).filter(Boolean)])];
            if (allImageUrls.length > 0) {
                enhancedPrompt += `\n\nPRODUCT GALLERY IMAGES:\n${allImageUrls.join('\n')}\n\nInclude relevant images in each variant's mediaIds.`;
            }

            const aiResponse = await axios.post("/api/ai/extract", {
                model: 'deepseek-chat',
                messages: [
                    { role: 'system', content: DGK_SYSTEM_PROMPT },
                    { role: 'user', content: enhancedPrompt }
                ],
                temperature: 0,
                response_format: { type: 'json_object' }
            });

            const object = JSON.parse(aiResponse.data.choices[0].message.content);
            const variants = normalizeGeneratedVariants(object.variants, missingVariants);

            // Apply form validation rules to AI-generated data
            for (let vi = 0; vi < variants.length; vi++) {
                const v = variants[vi];
                const dgkVariant = missingVariants[vi];
                if (dgkVariant) {
                    v.sku = String(dgkVariant.product_variant_id || dgkVariant.id || v.sku || vi + 1);
                    v.barcode = dgkVariant.supplier_code || v.barcode;
                }
                if (!v.sku || typeof v.sku !== "string") v.sku = String(vi + 1);
                if (typeof v.priceAmount !== "number" || isNaN(v.priceAmount)) v.priceAmount = 0;
                if (typeof v.inventoryQuantity !== "number" || isNaN(v.inventoryQuantity)) v.inventoryQuantity = 0;
                if (!v.inventoryTracking) v.inventoryTracking = "unit";
                if (!v.priceUnit) v.priceUnit = "unit";
                if (typeof v.active !== "boolean") v.active = true;
                if (v.offerEnabled && (typeof v.offerAmount !== "number" || isNaN(v.offerAmount))) v.offerAmount = 0;
                if (!v.attributeValues || typeof v.attributeValues !== "object") v.attributeValues = {};
                if (typeof v.attributeValues.weightGrams !== "number" || v.attributeValues.weightGrams <= 0) v.attributeValues.weightGrams = 1;
                // Fix color values
                for (const attrKey of Object.keys(v.attributeValues)) {
                    if (v.attributeValues[attrKey] && typeof v.attributeValues[attrKey] === "object") {
                        const obj = v.attributeValues[attrKey] as any;
                        v.attributeValues[attrKey] = obj.key || obj.name || String(obj);
                    }
                }
            }

            // Step 2: Upload all gallery images using server-side API (no CORS issues)
            toast.info("در حال آپلود تصاویر محصول...");
            const galleryLimit = largeImport ? 4 : 10;
            const uploadedGalleryMediaIds = galleryImageUrls.length > 0
                ? await downloadAndUploadImagesParallel(galleryImageUrls.slice(0, galleryLimit), IMAGE_UPLOAD_CONCURRENCY)
                : [];
            const variantImageMediaMap = await uploadImagesByUrl(missingVariants.map((item) => item.image_src).filter(Boolean), IMAGE_UPLOAD_CONCURRENCY);

            // Step 3: Process each variant's images
            for (let index = 0; index < variants.length; index++) {
                const variant = variants[index];
                variant.priceAmount = (variant.priceAmount || 0) / 10;
                variant.offerAmount = (variant.offerAmount || 0) / 10;

                if (!variant.priceUnit || !UNIT_OPTIONS.find((item) => item.value === variant.priceUnit))
                    variant.priceUnit = 'unit';
                if (!variant.inventoryTracking || !UNIT_OPTIONS.find((item) => item.value === variant.inventoryTracking))
                    variant.inventoryTracking = 'unit';

                // Ensure weightGrams exists
                if (!variant.attributeValues) variant.attributeValues = {};
                if (!variant.attributeValues.weightGrams || Number(variant.attributeValues.weightGrams) <= 0) variant.attributeValues.weightGrams = 1;

                const images = variant.mediaIds;
                variant.mediaIds = [];

                // Upload variant's own image_src (server-side, no CORS)
                const variantItem = missingVariants[index];
                if (variantItem?.image_src) {
                    const variantMediaId = variantImageMediaMap.get(cleanImageUrl(variantItem.image_src));
                    if (variantMediaId) variant.mediaIds.push(variantMediaId);
                }

                // Add gallery images to all variants
                if (uploadedGalleryMediaIds.length > 0) {
                    variant.mediaIds.push(...uploadedGalleryMediaIds);
                }

                // Process any AI-suggested image URLs (server-side)
                if (!largeImport && images?.length) {
                    for (let i = 0; i < images.length; i++) {
                        const address = images[i];
                        if (address.includes('digikala') || address.includes('dkstatics')) continue;
                        try {
                            const mediaId = await downloadAndUploadImage(address);
                            if (!variant.mediaIds.includes(mediaId)) {
                                variant.mediaIds.push(mediaId);
                            }
                        } catch {}
                    }
                }

                variant.mediaIds = Array.from(new Set(variant.mediaIds)).slice(0, largeImport ? 6 : 12);
            }

            const importResponse = await axios.post(`/api/digikala/products/${productId}/missing-variants`, {
                vendorId,
                variants,
                dgkVariants: missingVariants
            });

            toast.success(`${importResponse.data.importedCount || 0} واریانت با تصاویر وارد شد.`);
            handleLoadCompare();
            if (onImported) {
                await onImported();
            }
        } catch {
            toast.error("خطا در وارد کردن واریانت های جدید.");
        } finally {
            setImporting(false);
        }
    }

    useEffect(() => { if (open) handleLoadCompare(); }, [open]);

    return <>
        <Button variant="contained" color="warning" onClick={() => setOpen(true)}>
            مقایسه
        </Button>
        <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xl" fullWidth PaperProps={{ sx: { width: "min(96vw, 1600px)" } }}>
            <DialogTitle>
                <Stack direction="row" alignItems="center" gap={2}>
                    <Typography variant="h6">مقایسه واریانت ها</Typography>
                    <Typography variant="body2" color="text.secondary">{productTitle}</Typography>
                    <Box flex="1 1 auto" />
                    <RefreshButton onClick={handleLoadCompare} />
                    <IconButton onClick={() => setOpen(false)} aria-label="close window">
                        <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24">
                            <path fill="currentColor" d="m6.4 19-1.4-1.4 5.6-5.6-5.6-5.6 1.4-1.4 5.6 5.6 5.6-5.6 1.4 1.4-5.6 5.6 5.6 5.6-1.4 1.4-5.6-5.6z" />
                        </svg>
                    </IconButton>
                </Stack>
            </DialogTitle>
            <DialogContent>
                {(loading || importing) && <LinearProgress />}
                <Stack gap={2} sx={{ py: 2 }}>
                    <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
                        <Chip label={`واریانت های دیجی کالا: ${response?.variants.length || 0}`} />
                        <Chip color={missingVariants.length ? "warning" : "success"} label={`جدید در دیجی کالا: ${missingVariants.length}`} />
                        <Chip label={`واریانت های دیتابیس: ${response?.product?.variantCount || 0}`} />
                        {hasMissingSupplierCode && <Chip color="error" label="بعضی واریانت‌های جدید کد فروشنده ندارند" />}
                        {hasMissingSupplierCode && prefixes.map((prefix) => (
                            <Button
                                key={prefix.prefix}
                                size="small"
                                variant="outlined"
                                disabled={reservingCodes || loading || importing}
                                onClick={() => handleReserveMissingCodes(prefix.prefix)}
                            >
                                رزرو کد {prefix.name}
                            </Button>
                        ))}
                        <Box flex="1 1 auto" />
                        <Button variant="contained" disabled={importing || loading || reservingCodes || !missingVariants.length || hasMissingSupplierCode} onClick={handleImportMissing}>
                            وارد کردن واریانت های جدید
                        </Button>
                    </Stack>
                    <TableContainer sx={{ width: "100%", overflowX: "auto", border: 1, borderColor: "divider", borderRadius: 1 }}>
                        <Table sx={{
                            width: "100%",
                            tableLayout: "fixed",
                            "& th, & td": {
                                whiteSpace: "normal",
                                overflowWrap: "anywhere",
                                wordBreak: "break-word",
                                verticalAlign: "top",
                            },
                        }}>
                            <TableHead>
                                <TableRow>
                                    <TableCell width={56}>#</TableCell>
                                    <TableCell width="42%">واریانت دیجی کالا</TableCell>
                                    <TableCell width="18%">کد فروشنده</TableCell>
                                    <TableCell width="16%">قیمت</TableCell>
                                    <TableCell width="18%">موجودی</TableCell>
                                    <TableCell width="14%">وضعیت</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {response?.variants.map((item, index) => <TableRow key={item.product_variant_id} selected={!item.exists}>
                                    <TableCell>{index + 1}</TableCell>
                                    <TableCell>
                                        <Stack direction="row" alignItems="center" gap={1}>
                                            <Box component="img" src={item.image_src} width={56} height={56} alt={item.title} sx={{ borderRadius: .6 }} />
                                            <Stack>
                                                <Typography variant="body2" component={Link} target="_blank" href={`https://seller.digikala.com/pwa/product/${productId}/variant`}>{item.title}</Typography>
                                                <Typography variant="caption" color="text.secondary">{item.product_variant_id}</Typography>
                                            </Stack>
                                        </Stack>
                                    </TableCell>
                                    <TableCell>{item.supplier_code ? <Chip label={item.supplier_code} /> : <Chip color="error" label="ندارد" />}</TableCell>
                                    <TableCell>{(item.price_sale / 10).toLocaleString("fa-IR")} تومان</TableCell>
                                    <TableCell>
                                        <Stack gap={0.75}>
                                            <Stack direction="row" gap={0.75} flexWrap="wrap">
                                                <Chip
                                                    size="small"
                                                    color={item.active ? "success" : "warning"}
                                                    label={item.active ? "فعال" : "غیرفعال"}
                                                />
                                                <Chip
                                                    size="small"
                                                    color={Number(item.marketplace_seller_stock) > 0 ? "success" : "error"}
                                                    label={`موجودی: ${Number(item.marketplace_seller_stock ?? 0).toLocaleString("fa-IR")}`}
                                                />
                                            </Stack>
                                            <DgkStockPatchControl
                                                vendorId={vendorId}
                                                dgkVariantId={Number(item.product_variant_id || item.id)}
                                                initialStock={Number(item.marketplace_seller_stock ?? 0)}
                                                onUpdated={(stock) => {
                                                    setResponse((current) => {
                                                        if (!current) return current;
                                                        return {
                                                            ...current,
                                                            variants: current.variants.map((variant) =>
                                                                Number(variant.product_variant_id || variant.id) === Number(item.product_variant_id || item.id)
                                                                    ? { ...variant, marketplace_seller_stock: stock }
                                                                    : variant,
                                                            ),
                                                        };
                                                    });
                                                }}
                                            />
                                        </Stack>
                                    </TableCell>
                                    <TableCell>
                                        <Stack direction="row" gap={0.75} flexWrap="wrap">
                                            {item.exists ? <Chip color="success" label="در دیتابیس هست" /> : <Chip color="warning" label="جدید" />}
                                            {!item.active ? <Chip color="warning" variant="outlined" label="نیازمند فعال‌سازی در پنل دیجی‌کالا" /> : null}
                                        </Stack>
                                    </TableCell>
                                </TableRow>)}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Stack>
            </DialogContent>
        </Dialog>
    </>
}
