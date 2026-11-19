import { Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogProps, DialogTitle, Divider, IconButton, Stack, TextField, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { UseFieldArrayAppend, UseFieldArrayRemove, useFormContext, useWatch } from "react-hook-form";
import VariantFull from "./variant-full";
import { AttributeDef } from "@/catalog/models/ProductType";
import { ProductStatus } from "@/catalog/models/Product";


type AttributeRecord = Record<string, unknown>;


type ProductFormValues = {
    productTypeId: string;
    title: string;
    slug: string;
    description: string;
    brand: string;
    seoTitle: string;
    seoDescription: string;
    status: ProductStatus;
    showInCart: boolean;
    attributeValues: AttributeRecord;
    categories: string[];
    variants: VariantFormValue[];
};

type ProductTypeOption = {
    id: string;
    name: string;
    version?: number;
    attributes: AttributeDef[];
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
    attributeValues: AttributeRecord;
};


type Props = DialogProps & {
    append: UseFieldArrayAppend<ProductFormValues, "variants">
    remove: UseFieldArrayRemove
    variantAttributes: AttributeDef[]
    productType: ProductTypeOption | undefined
    PRICE_MODEL_OPTIONS: readonly [{ readonly value: "fixed"; readonly label: "قیمت ثابت"; }, { readonly value: "per_unit"; readonly label: "بر اساس واحد"; }]
}

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


export default function VariantWizard({ open, onClose, PRICE_MODEL_OPTIONS, productType, variantAttributes, append, remove, ...props }: Props) {
    const { control } = useFormContext();

    const variantsWatch: VariantFormValue[] = useWatch({ control, name: 'variants', defaultValue: [] as VariantFormValue[] });

    const STEPS_MAX = 7 + variantsWatch.length;

    const [step, setStep] = useState(1);

    const [common, setCommon] = useState<Omit<VariantFormValue, "sku" | "active">>({
        priceModel: "fixed",
        inventoryTracking: "unit",
        priceUnit: "unit",
        priceAmount: 100_000,
        inventoryLowStock: 5,
        attributeValues: {},
        mediaIds: [],
        offerEnabled: false,
        ...(variantsWatch[0] as any || {}),
    })


    const change = (field: string, value: any) => {
        setCommon(l => ({ ...l, [field]: value }))
    }

    useEffect(() => {
        if (common.offerAmount) setCommon(l => ({ ...l, offerEnabled: true }))
    }, [common.offerAmount]);

    useEffect(() => {
        if (step <= 7) return;

        const index = step - 8;

        if (variantsWatch[index]) return;

        const newVariant = { ...common, active: true, sku: `sku-${variantsWatch.length + 1}`, attributeValues: {}, mediaIds: [], }

        append(newVariant)

    }, [step]);

    useEffect(() => {
        if (open) return;
        setStep(1);
    }, [open])


    const basePrice = Number(common?.priceAmount ?? 0);
    const offerAmount = common?.offerEnabled ? Number(common?.offerAmount ?? 0) : 0;
    const hasOfferPreview = Boolean(common?.offerEnabled) && basePrice > 0 && offerAmount >= 0;
    const discountedPrice = Math.max(0, basePrice - offerAmount);

    return <Dialog
        open={open}
        maxWidth="sm"
        fullWidth
        slotProps={{
            paper: {
                sx: {
                    minHeight: 200,
                }
            }
        }}
        {...props}>

        <DialogTitle>
            <Stack direction="row" alignItems="center" gap={1}>
                <CircularProgress
                    thickness={7}
                    size={18}
                    value={(step / STEPS_MAX) * 100}
                    variant="determinate"
                    enableTrackSlot
                />
                <Typography variant="subtitle2">
                    مرحله {step} از {STEPS_MAX}
                </Typography>
                <Box flex="1 1 auto" />
                {
                    step > 7 && <>
                        <Typography variant="caption" color="text.secondary">
                            کارت تموم شد اینو بزن
                        </Typography>
                        <svg xmlns="http://www.w3.org/2000/svg" width={14} height={14} viewBox="0 0 24 24">
                            <g fill="none">
                                <path fill="currentColor" d="M20 12.75a.75.75 0 0 0 0-1.5zm0-1.5H4v1.5h16z" opacity={0.5}></path>
                                <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="m10 6l-6 6l6 6"></path>
                            </g>
                        </svg>
                    </>
                }
                <IconButton onClick={() => onClose?.({}, "backdropClick")} aria-label="close window">
                    <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24">
                        <path
                            fill="currentColor"
                            d="m6.4 19l-1.4-1.4l5.6-5.6l-5.6-5.6l1.4-1.4l5.6 5.6l5.6-5.6l1.4 1.4l-5.6 5.6l5.6 5.6l-1.4 1.4l-5.6-5.6z"
                        />
                    </svg>
                </IconButton>
            </Stack>
        </DialogTitle>

        <DialogContent>
            <Stack alignItems="center" justifyContent="center" sx={{ minHeight: 170 }}>
                {
                    step === 1 && <Box>
                        <Typography>مدل قیمت این محصول رو انتخاب کن:</Typography>

                        <Stack direction="row" gap={1} sx={{ mt: 2 }}>
                            <Button variant={common.priceModel === 'fixed' ? "contained" : "outlined"} onClick={() => change("priceModel", "fixed")}>
                                قیمت ثابت
                            </Button>
                            <Button variant={common.priceModel === 'per_unit' ? "contained" : "outlined"} onClick={() => change("priceModel", "per_unit")}>
                                قیمت بر اساس واحد
                            </Button>
                        </Stack>
                    </Box>
                }
                {
                    step === 2 && <Box>
                        <Typography>واحد قیمت محصول رو هم انتخاب کن:</Typography>

                        <Stack direction="row" gap={1} sx={{ mt: 2 }} flexWrap="wrap">
                            {UNIT_OPTIONS.map(x => <Button
                                key={x.value}
                                variant={x.value === common.priceUnit ? "contained" : "outlined"}
                                color="primary"
                                onClick={() => change("priceUnit", x.value)}>
                                {x.label}
                            </Button>)}
                        </Stack>
                    </Box>
                }
                {
                    step === 3 && <Box>
                        <Typography>واحد موجودی انبار رو هم تعیین کن:</Typography>

                        <Stack direction="row" gap={1} sx={{ mt: 2 }} flexWrap="wrap">
                            {UNIT_OPTIONS.map(x => <Button
                                key={x.value}
                                variant={x.value === common.priceUnit ? "contained" : "outlined"}
                                color="primary"
                                onClick={() => change("priceUnit", x.value)}>
                                {x.label}
                            </Button>)}
                        </Stack>
                    </Box>
                }
                {
                    step === 4 && <Box>
                        <Typography>قیمت محصول چنده؟</Typography>

                        <Stack gap={2} sx={{ mt: 2, width: '100%' }} >
                            <TextField
                                type="number"
                                value={(common.priceAmount || 0) / 1000}
                                label="قیمت"
                                onChange={e => change("priceAmount", Number(e.target.value) * 1000)}
                            />
                            <Typography variant="h6" textAlign="center">
                                {common.priceAmount?.toLocaleString()} تومان
                            </Typography>
                        </Stack>
                    </Box>
                }
                {
                    step === 5 && <Box>
                        <Typography>از هر واریانت چند {UNIT_OPTIONS.find(x => x.value === common.inventoryTracking)?.label} داری؟</Typography>

                        <Stack gap={2} sx={{ mt: 2, width: '100%' }} >
                            <TextField
                                type="number"
                                value={common.inventoryQuantity}
                                label={UNIT_OPTIONS.find(x => x.value === common.inventoryTracking)?.label || "مقدار"}
                                onChange={e => change("inventoryQuantity", Number(e.target.value))}
                            />
                        </Stack>
                    </Box>
                }
                {
                    step === 6 && <Box>
                        <Typography>حداقل و حد اکثر سفارش مجاز برای این محصول چقدره؟</Typography>
                        <Typography variant="caption">مشتری برای خرید، حد اقل چقدر باید ور داره و حد اکثر چقدر؟ اگر محدودیتی نداره برو بعدی و این قسمت رو بیخیال!</Typography>

                        <Stack gap={2} sx={{ mt: 2 }} direction="row">
                            <TextField
                                type="number"
                                value={common.minimumOrderQuantity}
                                label="حد اقل"
                                onChange={e => change("minimumOrderQuantity", Number(e.target.value))}
                            />
                            <TextField
                                type="number"
                                value={common.maximumOrderQuantity}
                                label="حد اکثر"
                                onChange={e => change("maximumOrderQuantity", Number(e.target.value))}
                            />
                        </Stack>
                    </Box>
                }
                {
                    step === 7 && <Box>
                        <Typography>تخفیف ویژه هم داره؟</Typography>

                        <Stack gap={2} sx={{ mt: 2, width: '100%' }} >
                            <TextField
                                type="number"
                                value={(common.offerAmount || 0) / 1000}
                                label="مبلغ تخفیف"
                                onChange={e => change("offerAmount", Number(e.target.value) * 1000)}
                            />


                            {hasOfferPreview ? (
                                <Typography variant="body2" color="text.secondary">
                                    <Box component="span" sx={{ fontWeight: 'bold', mx: 1 }}>{common.offerAmount?.toLocaleString()} تومان | </Box>

                                    <Box component="span" sx={{ textDecoration: 'line-through', mx: 1, color: 'error.main' }}>{`${basePrice.toLocaleString()} تومان`}</Box>
                                    <Box component="span" sx={{ fontWeight: 600, color: 'success.main' }}>{`${discountedPrice.toLocaleString()} تومان`}</Box>
                                </Typography>
                            ) : null}
                        </Stack>
                    </Box>
                }
                {variantsWatch.map((field, index) => {
                    const variantValue = variantsWatch?.[index];
                    const basePrice = Number(variantValue?.priceAmount ?? 0);
                    const offerAmount = variantValue?.offerEnabled ? Number(variantValue?.offerAmount ?? 0) : 0;
                    const hasOfferPreview = Boolean(variantValue?.offerEnabled) && basePrice > 0 && offerAmount >= 0;
                    const discountedPrice = Math.max(0, basePrice - offerAmount);

                    const variants = productType?.attributes.filter(x => x.variant);

                    const label = variants?.map(x => field.attributeValues[x.key] ? `${x.label}: ${field.attributeValues[x.key]}` : false).filter(x => x).join(" | ")

                    const offerEnabled = field.offerEnabled;
                    return index + 8 === step && (
                        <Box key={index}>
                            <Typography variant="overline">
                                {label || `واریانت شماره ${index + 1}`}
                            </Typography>
                            <Divider sx={{ my: 2 }} />
                            <VariantFull
                                PRICE_MODEL_OPTIONS={PRICE_MODEL_OPTIONS}
                                UNIT_OPTIONS={UNIT_OPTIONS as any}
                                basePrice={basePrice}
                                discountedPrice={discountedPrice}
                                hasOfferPreview={hasOfferPreview}
                                index={index}
                                variantAttributes={variantAttributes}
                                offerEnabled={offerEnabled}
                                onDelete={() => { remove(index) }}
                                minimized
                            />
                        </Box>
                    );
                })}
            </Stack>
        </DialogContent>

        <DialogActions>
            {step > 1 && <Button
                onClick={() => setStep(l => l - 1)}
                startIcon={<svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24">
                    <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="m9 5l2 2.333M9 19l6-7l-1.5-1.75"></path>
                </svg>}>
                قبلی
            </Button>}
            <Box flex="1 1 auto" />
            <Button
                onClick={() => setStep(l => l + 1)}
                endIcon={<svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24">
                    <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="m15 19l-6-7l1.5-1.75M15 5l-2 2.333"></path>
                </svg>}
            >
                بعدی
            </Button>
        </DialogActions>
    </Dialog>
}