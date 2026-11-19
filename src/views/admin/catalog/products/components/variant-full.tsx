import { Field } from "@/components/hook-form";
import { Box, Button, Divider, Grid, MenuItem, Stack, Typography } from "@mui/material";
import AttributeFields from "./attribute-fields";


type Option = { label: string, value: string }

type Props = {
    index: number,
    PRICE_MODEL_OPTIONS: readonly [{ readonly value: "fixed"; readonly label: "قیمت ثابت"; }, { readonly value: "per_unit"; readonly label: "بر اساس واحد"; }]
    UNIT_OPTIONS: Option[]
    hasOfferPreview: boolean
    basePrice: number
    discountedPrice: number
    variantAttributes: any
    offerEnabled: boolean
    onDelete: VoidFunction
    minimized?: boolean
}
export default function VariantFull({ onDelete, index, PRICE_MODEL_OPTIONS, UNIT_OPTIONS, basePrice, hasOfferPreview, discountedPrice, variantAttributes, offerEnabled, minimized = false }: Props) {
    return <Stack spacing={2}>

        {
            !minimized && <>
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Field.Switch name={`variants.${index}.active`} label="فعال" />
                    <Button variant="outlined" color="error" onClick={onDelete}>
                        حذف واریانت
                    </Button>
                </Stack>
                <Grid container spacing={2}>
                    <Grid size={{ xs: 12, md: 4 }}>
                        <Field.Text name={`variants.${index}.sku`} label="شناسه واریانت" required fullWidth />
                    </Grid>
                    <Grid size={{ xs: 12, md: 4 }}>
                        <Field.Select name={`variants.${index}.priceModel`} label="مدل قیمت" fullWidth>
                            {PRICE_MODEL_OPTIONS.map((option) => (
                                <MenuItem key={option.value} value={option.value}>
                                    {option.label}
                                </MenuItem>
                            ))}
                        </Field.Select>
                    </Grid>
                    <Grid size={{ xs: 12, md: 4 }}>
                        <Field.Text
                            name={`variants.${index}.priceAmount`}
                            label="قیمت پایه"
                            type="number"
                            fullWidth
                            required
                        />
                    </Grid>

                    <Grid size={{ xs: 12, md: 4 }}>
                        <Field.Select name={`variants.${index}.priceUnit`} label="واحد قیمت" fullWidth>
                            <MenuItem value="">بدون واحد</MenuItem>
                            {UNIT_OPTIONS.map((option) => (
                                <MenuItem key={option.value} value={option.value}>
                                    {option.label}
                                </MenuItem>
                            ))}
                        </Field.Select>
                    </Grid>

                    <Grid size={{ xs: 12, md: 4 }}>
                        <Field.Select name={`variants.${index}.inventoryTracking`} label="واحد موجودی" fullWidth>
                            {UNIT_OPTIONS.map((option) => (
                                <MenuItem key={option.value} value={option.value}>
                                    {option.label}
                                </MenuItem>
                            ))}
                        </Field.Select>
                    </Grid>

                    <Grid size={{ xs: 12, md: 4 }}>
                        <Field.Text
                            name={`variants.${index}.inventoryQuantity`}
                            label="تعداد موجودی"
                            type="number"
                            required
                            fullWidth
                        />
                    </Grid>

                    <Grid size={{ xs: 12, md: 4 }}>
                        <Field.Text
                            name={`variants.${index}.inventoryLowStock`}
                            label="هشدار موجودی"
                            type="number"
                            fullWidth
                            helperText="اختیاری"
                        />
                    </Grid>

                    <Grid size={{ xs: 12, md: 4 }}>
                        <Field.Text
                            name={`variants.${index}.minimumOrderQuantity`}
                            label="حداقل مقدار سفارش"
                            type="number"
                            fullWidth
                            helperText="اختیاری"
                        />
                    </Grid>

                    <Grid size={{ xs: 12, md: 4 }}>
                        <Field.Text
                            name={`variants.${index}.maximumOrderQuantity`}
                            label="حداکثر مقدار سفارش"
                            type="number"
                            fullWidth
                            helperText="اختیاری"
                        />
                    </Grid>

                    <Grid size={{ xs: 12 }}>
                        <Field.Text name={`variants.${index}.barcode`} label="بارکد" fullWidth />
                    </Grid>
                </Grid>

                <Divider />

                <Stack spacing={2}>

                    <Stack direction="row" alignItems="center" justifyContent="space-between">
                        <Typography variant="subtitle1">تخفیف و پیشنهاد</Typography>
                        <Field.Switch name={`variants.${index}.offerEnabled`} label="تخفیف فعال" />
                    </Stack>

                    <Grid container spacing={2}>
                        <Grid size={{ xs: 12, md: 4 }}>
                            <Field.Text
                                name={`variants.${index}.offerAmount`}
                                label="مقدار تخفیف"
                                type="number"
                                helperText="به تومان"
                                fullWidth
                            />
                        </Grid>
                        <Grid size={{ xs: 12, md: 4 }}>
                            <Field.JalaliDate
                                name={`variants.${index}.offerStartsAt`}
                                label="شروع"
                                withTime
                                fullWidth
                            />
                        </Grid>
                        <Grid size={{ xs: 12, md: 4 }}>
                            <Field.JalaliDate
                                name={`variants.${index}.offerEndsAt`}
                                label="پایان"
                                withTime
                                fullWidth
                            />
                        </Grid>
                        <Grid size={{ xs: 12, md: 6 }}>
                            <Field.Text name={`variants.${index}.offerLabel`} label="برچسب" fullWidth />
                        </Grid>
                    </Grid>
                    {hasOfferPreview ? (
                        <Typography variant="body2" color="text.secondary">
                            <Box component="span" sx={{ textDecoration: 'line-through', mx: 1 }}>{`${basePrice.toLocaleString()} تومان`}</Box>
                            <Box component="span" sx={{ fontWeight: 600 }}>{`${discountedPrice.toLocaleString()} تومان`}</Box>
                        </Typography>
                    ) : null}
                </Stack>

                <Divider />

                <Stack spacing={2}>
                    <Typography variant="subtitle1">تصاویر و رسانه‌های واریانت</Typography>
                    <Field.UploadImage
                        name={`variants.${index}.mediaIds`}
                        multiple
                        helperText="تصاویر واریانت را بارگذاری یا انتخاب کنید"
                    />
                </Stack>

                <Divider />

                <Stack spacing={2}>
                    <Typography variant="subtitle1">ویژگی‌های واریانت</Typography>
                    <AttributeFields
                        attributes={variantAttributes}
                        namePrefix={`variants.${index}.attributeValues`}
                    />
                </Stack>
            </>
        }
        {
            minimized && <Stack gap={2}>
                <AttributeFields
                    attributes={variantAttributes}
                    namePrefix={`variants.${index}.attributeValues`}
                />

                <Divider />
                <Field.UploadImage
                    name={`variants.${index}.mediaIds`}
                    multiple
                />
            </Stack>
        }

    </Stack>
}