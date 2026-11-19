import { CategoryDocument } from "@/catalog/models/Category";
import { VariantSchema } from "@/catalog/models/Product";
import { AttributeDef, ProductTypeDocument } from "@/catalog/models/ProductType";
import { ImageUploader } from "@/components/image-uploader";
import { Card, CardContent, Divider, Stack, Typography } from "@mui/material";
import { useFormContext } from "react-hook-form";


type AttributeRecord = Record<string, unknown>;
type VariantFormValue = {
    sku: string;
    active: boolean;
    priceModel: 'fixed' | 'per_unit';
    priceAmount?: number;
    priceUnit?: string;
    inventoryTracking: string;
    inventoryQuantity?: number;
    inventoryLowStock?: number;
    barcode?: string;
    offerEnabled: boolean;
    offerAmount?: number;
    offerStartsAt?: string;
    offerEndsAt?: string;
    offerLabel?: string;
    mediaIds: string[];
    attributeValues: AttributeRecord;
};

const PRICE_MODEL_OPTIONS = [
    { value: 'fixed', label: 'قیمت ثابت' },
    { value: 'per_unit', label: 'بر اساس واحد' },
] as const;

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



export default function ProductLLMRender({ categories, productTypes }: {
    categories: CategoryDocument[];
    productTypes: ProductTypeDocument[];
}) {
    const { watch, setValue } = useFormContext();

    const product = watch();

    const type = productTypes.find(x => x.id === product.productTypeId)

    return <Stack gap={2} sx={{ my: 4 }}>
        <Text
            label="نوع محصول"
            value={type?.name || "-"}
        />
        <Text
            label="عنوان محصول"
            value={product.title}
        />
        <Text
            label="اسلاگ"
            value={product.slug}
        />
        <Text
            label="برند"
            value={product.brand}
        />
        <Text
            label="توضیحات"
            value={product.description}
        />
        <Text
            label="دسته بندی"
            value={categories.filter(x => product.categories.some((c: any) => c === x.id))?.map(x => x.name).join(", ") || "-"}
        />

        <Divider sx={{ mx: 4, my: 2 }} />

        {
            product.variants.map((item: VariantFormValue, i: number) => <Card key={item.sku || i.toString()}>

                <CardContent>
                    <Text
                        label="کد"
                        value={item.sku}
                    />
                    <Text
                        label="مدل قیمت"
                        value={PRICE_MODEL_OPTIONS.find(x => x.value === item.priceModel)?.label || "-"}
                    />
                    <Text
                        label="قیمت پایه"
                        value={Intl.NumberFormat("en-US").format(item.priceAmount || 0)}
                    />
                    <Text
                        label="واحد قیمت"
                        value={UNIT_OPTIONS.find(x => x.value === item.priceUnit)?.label || "-"}
                    />
                    <Text
                        label="واحد موجودی"
                        value={UNIT_OPTIONS.find(x => x.value === item.inventoryTracking)?.label || "-"}
                    />
                    <Text
                        label="تعداد موجودی"
                        value={item.inventoryQuantity?.toString() || "-"}
                    />
                    <Text
                        label="مقدار تخفیف"
                        value={Intl.NumberFormat("en-US").format(item.offerAmount || 0)}
                    />

                    <Divider sx={{ m: 2 }} />

                    {
                        type?.attributes.map(attr =>
                            <Text
                                key={attr.key}
                                label={attr.label}
                                value={renderAttrValue(attr, item.attributeValues)}
                            />)
                    }

                    <Divider sx={{ m: 2 }} />

                    <ImageUploader
                        multiple
                        value={item.mediaIds}
                        maxFiles={10}
                        label="تصویر"
                        scope="attachment"
                        onChange={values => setValue(`variants.${i}.mediaIds`, values)}
                    />
                </CardContent>
            </Card>)
        }
    </Stack>
}

function Text({ label, value }: { label: string, value: string }) {
    return <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        gap={2}
        flexWrap="wrap"
    >
        <Typography variant="body2" color="text.secondary">
            {label}
        </Typography>
        <Typography variant="body1">
            {value}
        </Typography>
    </Stack>
}

function renderAttrValue(attr: AttributeDef, values: Record<string, any>) {

    switch (attr.kind) {
        case "text":
        case "number":
        case "enum":
        case "json":
            return values[attr.key] || "-"
        case "boolean":
            return values[attr.key] ? "✅" : "👎"
        case "multi-enum":
            return values[attr.key]?.join && values[attr.key]?.join(", ")
        case "color":
            return (attr.values ?? [])
                .filter(x => values[attr.key] instanceof Array ? values[attr.key].some((z: string) => z === x.key) : x.key === values[attr.key])
                .map((color) => color.name)
                .join(", ")
        default:
            return "!!!"
    }
}