'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  FormControlLabel,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { toast } from 'sonner';

import type { InvoiceLineView } from './InvoiceLinesTable';
import { requestTapin } from './tapin-shipment-api';
import {
  buildManualTapinPayload,
  calculateTapinProductWeight,
  manualTapinPayloadFingerprint,
} from './tapin-shipment-form';
import type {
  KioskOption,
  ManualTapinFormInput,
  TapinKiosksResponse,
  TapinOptionsResponse,
  TapinQuoteResponse,
  TapinShipmentView,
} from './tapin-shipment.types';
import { TAPIN_STATUS_LABELS as STATUS_LABELS } from '@/services/tapin/statuses';

type TapinInvoiceView = {
  id: string;
  number: string;
  shippingPaymentMethod: string;
  addressSnapshot: Record<string, any> | null;
  lines: InvoiceLineView[];
  tapinShipment?: TapinShipmentView | null;
};

type Props = {
  invoice: TapinInvoiceView;
  onChanged: () => void;
};

function normalize(value: string) {
  return value.replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/\s+/g, '').trim().toLowerCase();
}

function formatPrice(value: unknown): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return Math.round(value / 10).toLocaleString('fa-IR') + ' تومان';
}

function formatGrams(value: unknown): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return value.toLocaleString('fa-IR') + ' گرم';
}

function tapinErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'عملیات تاپین ناموفق بود.';
}

function useTapinShipmentCardView({ invoice, onChanged }: Props) {
  const [options, setOptions] = useState<TapinOptionsResponse['data']>();
  const [loading, setLoading] = useState(false);
  const [optionsError, setOptionsError] = useState('');
  const [provinceCode, setProvinceCode] = useState(0);
  const [cityCode, setCityCode] = useState(0);
  const [boxId, setBoxId] = useState(0);
  const [packageWeight, setPackageWeight] = useState<number | ''>('');
  const [orderType, setOrderType] = useState<1 | 3 | 5 | ''>('');
  const [registerType, setRegisterType] = useState<0 | 1 | 2 | ''>('');
  const [shopId, setShopId] = useState('');
  const [payType, setPayType] = useState<0 | 1 | 2 | 3 | ''>('');
  const [packetType, setPacketType] = useState<1 | 2 | 3 | ''>('');
  const [contentType, setContentType] = useState<1 | 2 | 3 | 4 | ''>('');
  const [hasInsurance, setHasInsurance] = useState<boolean | null>(null);
  const [packagingPriceToman, setPackagingPriceToman] = useState<number | ''>('');
  const [prePaidPriceToman, setPrePaidPriceToman] = useState<number | ''>('');
  const [employeeCode, setEmployeeCode] = useState<number | ''>('');
  const [presenterCode, setPresenterCode] = useState('');
  const [kiosks, setKiosks] = useState<KioskOption[]>([]);
  const [kioskId, setKioskId] = useState<number | ''>('');
  const [parcelTurning, setParcelTurning] = useState(false);
  const [quote, setQuote] = useState<Record<string, number> | null>(null);
  const [quoteFingerprint, setQuoteFingerprint] = useState<string | null>(null);
  const quoteRequestRef = useRef(0);
  const [itemWeights, setItemWeights] = useState<Record<string, number>>({});

  const tapinShipment = invoice.tapinShipment;
  const addressState = invoice.addressSnapshot?.state;
  const addressCity = invoice.addressSnapshot?.city;

  useEffect(() => {
    if (tapinShipment) return;

    void requestTapin<TapinOptionsResponse>('/api/admin/tapin/options')
      .then((result) => {
        const next = result.data;
        setOptions(next);
        if (!next) return;
        if (next.warnings?.length) {
          setOptionsError(`بخشی از تنظیمات تاپین در دسترس نیست: ${next.warnings.join('، ')}`);
        }

        // Destination codes come from the customer's saved order address. The
        // admin still sees and can correct the selections before registering.
        const province = next.states.find(
          (item) => normalize(item.title) === normalize(String(addressState || '')),
        );
        if (province) {
          setProvinceCode(province.code);
          const city = province.cities?.find(
            (item) => normalize(item.title) === normalize(String(addressCity || '')),
          );
          if (city) setCityCode(city.code);
        }
      })
      .catch((error) => setOptionsError(tapinErrorMessage(error)));
  }, [addressCity, addressState, tapinShipment]);

  useEffect(() => {
    if (tapinShipment) return;
    setItemWeights(
      Object.fromEntries(
        invoice.lines
          .map((line) => {
            const key = line.variantId ?? line.sku;
            return key ? [key, Math.max(0, Math.round(line.weightGrams ?? 0))] : null;
          })
          .filter((entry): entry is [string, number] => Boolean(entry)),
      ),
    );
  }, [invoice.lines, tapinShipment]);

  useEffect(() => {
    if (!shopId || tapinShipment) return;
    void requestTapin<TapinOptionsResponse>(
      `/api/admin/tapin/options?shopId=${encodeURIComponent(shopId)}`,
    )
      .then((result) => {
        const next = result.data;
        if (!next) return;
        setOptions(next);
        if (next.warnings?.length) {
          setOptionsError(`بخشی از تنظیمات تاپین در دسترس نیست: ${next.warnings.join('، ')}`);
        }
        // Do not choose a box for the admin. The selected shop only refreshes
        // the official box list; packaging remains an explicit decision.
        setBoxId(0);
        setKiosks([]);
        setKioskId('');
        quoteRequestRef.current += 1;
        setQuote(null);
        setQuoteFingerprint(null);
      })
      .catch((error) => setOptionsError(tapinErrorMessage(error)));
  }, [shopId, tapinShipment]);

  const cities = useMemo(
    () => options?.states.find((item) => item.code === provinceCode)?.cities ?? [],
    [options, provinceCode],
  );
  const productWeight = calculateTapinProductWeight(invoice.lines, itemWeights);
  const itemWeightsPayload = invoice.lines
    .filter((line) => line.variantId)
    .map((line) => ({
      variantId: line.variantId as string,
      weightGrams: Math.max(
        0,
        Math.round(itemWeights[line.variantId as string] ?? line.weightGrams ?? 0),
      ),
    }));

  const formInput: ManualTapinFormInput = {
    invoiceId: invoice.id,
    shopId,
    provinceCode,
    cityCode,
    boxId,
    packetType,
    packageWeight,
    orderType,
    registerType,
    contentType,
    hasInsurance,
    payType,
    employeeCode,
    prePaidPrice: prePaidPriceToman === '' ? '' : Math.round(prePaidPriceToman * 10),
    packagingPrice: packagingPriceToman === '' ? '' : Math.round(packagingPriceToman * 10),
    presenterCode: presenterCode ? Number(presenterCode) : '',
    kioskId,
    duration: kioskId === '' ? '' : 48,
    parcelTurning: kioskId === '' ? undefined : parcelTurning,
    itemWeights: itemWeightsPayload,
  };
  const payload = buildManualTapinPayload(formInput);
  const payloadFingerprint = payload ? manualTapinPayloadFingerprint(payload) : null;
  const quoteIsCurrent = Boolean(quote && quoteFingerprint && quoteFingerprint === payloadFingerprint);
  const ready = Boolean(payload && productWeight > 0);

  const clearQuote = () => {
    quoteRequestRef.current += 1;
    setQuote(null);
    setQuoteFingerprint(null);
  };

  const run = async (action: 'quote' | 'register') => {
    if (!payload || !ready) {
      toast.error('ابتدا همهٔ مشخصات بسته‌بندی و وزن کالا را تکمیل کنید.');
      return;
    }
    if (action === 'register' && !quoteIsCurrent) {
      toast.error('ابتدا هزینهٔ ارسال را استعلام کنید.');
      return;
    }
    const requestId = action === 'quote' ? ++quoteRequestRef.current : quoteRequestRef.current;
    const requestedFingerprint = manualTapinPayloadFingerprint(payload);
    setLoading(true);
    try {
      const result = await requestTapin<TapinQuoteResponse>(
        action === 'quote' ? '/api/admin/tapin/quote' : '/api/admin/tapin/shipments',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );
      if (action === 'quote') {
        if (requestId === quoteRequestRef.current) {
          setQuote(result.data ?? null);
          setQuoteFingerprint(result.data ? requestedFingerprint : null);
          toast.success('هزینهٔ واقعی ارسال از تاپین دریافت شد.');
        }
      } else {
        toast.success('مرسوله با تأیید ادمین در تاپین ثبت شد.');
        onChanged();
      }
    } catch (error) {
      toast.error(tapinErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const loadKiosks = async () => {
    if (!provinceCode || !cityCode || !shopId) return;
    setLoading(true);
    try {
      const result = await requestTapin<TapinKiosksResponse>(
        `/api/admin/tapin/kiosks?provinceCode=${provinceCode}&cityCode=${cityCode}&shopId=${shopId}`,
      );
      setKiosks(result.data?.list ?? []);
    } catch (error) {
      toast.error(tapinErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const syncOrStatus = async (status?: number) => {
    setLoading(true);
    try {
      await requestTapin<object>(
        `/api/admin/tapin/shipments/${invoice.id}`,
        status === undefined
          ? undefined
          : {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ status }),
            },
      );
      toast.success(status === undefined ? 'وضعیت مرسوله به‌روز شد.' : 'وضعیت مرسوله تغییر کرد.');
      onChanged();
    } catch (error) {
      toast.error(tapinErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const updateShipment = async () => {
    if (!window.confirm('اطلاعات فعلی سفارش در تاپین به‌روزرسانی شود؟')) return;
    setLoading(true);
    try {
      await requestTapin<object>(`/api/admin/tapin/shipments/${invoice.id}`, { method: 'PUT' });
      toast.success('اطلاعات مرسوله در تاپین ویرایش شد.');
      onChanged();
    } catch (error) {
      toast.error(tapinErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  if (tapinShipment) {
    return (
      <Card variant="outlined" sx={{ borderRadius: 2 }}>
        <CardContent>
          <Stack spacing={1.5}>
            <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={1}>
              <Typography variant="h6">مرسولهٔ تاپین</Typography>
              <Chip color="primary" label={STATUS_LABELS[tapinShipment.status] ?? `وضعیت ${tapinShipment.status}`} />
            </Stack>
            <Typography variant="body2">
              شناسهٔ تاپین: <span dir="ltr">{tapinShipment.orderId}</span>
            </Typography>
            <Typography variant="body2">
              بارکد: <span dir="ltr">{tapinShipment.barcode || 'در پاسخ تاپین صادر نشده'}</span>
            </Typography>
            <Typography variant="body2" color="text.secondary">
              هزینهٔ ارسال: {formatPrice(tapinShipment.sendPrice)} — مبلغ کل تاپین: {formatPrice(tapinShipment.totalPrice)}
            </Typography>
            <Alert severity="info">
              اقدام باقی‌مانده: لیبل واقعی را دریافت و چاپ کنید، روی بسته بچسبانید و طبق روش جمع‌آوری تحویل دهید.
            </Alert>
            <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} flexWrap="wrap">
              <Button disabled={loading} variant="outlined" onClick={() => syncOrStatus()}>
                به‌روزرسانی وضعیت
              </Button>
              {[0, 1, 100, -1].includes(tapinShipment.status) && tapinShipment.provinceCode ? (
                <Button disabled={loading} variant="outlined" onClick={updateShipment}>
                  ارسال ویرایش‌ها به تاپین
                </Button>
              ) : null}
              {tapinShipment.id ? (
                <Button component="a" target="_blank" href={`/api/admin/tapin/shipments/${invoice.id}/label`}>
                  دریافت لیبل واقعی
                </Button>
              ) : null}
              {tapinShipment.orderId ? (
                <Button component="a" target="_blank" href={`/api/admin/tapin/shipments/${invoice.id}/invoice`}>
                  فاکتور تاپین
                </Button>
              ) : null}
              {tapinShipment.status === 0 ? (
                <Button disabled={loading} onClick={() => syncOrStatus(1)}>
                  آماده چاپ
                </Button>
              ) : null}
              {tapinShipment.status === 1 ? (
                <Button disabled={loading} onClick={() => syncOrStatus(2)}>
                  آماده ارسال
                </Button>
              ) : null}
              {[0, 1, 3].includes(tapinShipment.status) ? (
                <Button
                  disabled={loading}
                  color="error"
                  onClick={() => window.confirm('مرسوله حذف شود؟') && syncOrStatus(80)}
                >
                  حذف مرسوله
                </Button>
              ) : null}
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    );
  }

  const customerName = [invoice.addressSnapshot?.fname, invoice.addressSnapshot?.lname]
    .filter(Boolean)
    .join(' ');

  return (
    <Card variant="outlined" sx={{ borderRadius: 2 }}>
      <CardContent>
        <Stack spacing={2}>
          <Stack spacing={0.5}>
            <Typography variant="h6">آماده‌سازی دستی مرسولهٔ تاپین</Typography>
            <Typography variant="body2" color="text.secondary">
              اطلاعات مشتری و سفارش از فاکتور خوانده شده است؛ مشخصات بسته‌بندی را شما وارد کنید.
            </Typography>
          </Stack>

          <Alert severity="info">
            بازکردن سفارش یا پرداخت موفق، هیچ مرسوله‌ای در تاپین ثبت نمی‌کند. ثبت فقط بعد از تکمیل فرم و تأیید شما انجام می‌شود.
          </Alert>

          <Stack spacing={0.5} sx={{ p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
            <Typography variant="subtitle2">اطلاعات خواندنی سفارش</Typography>
            <Typography variant="body2">گیرنده: {customerName || '—'}</Typography>
            <Typography variant="body2">تلفن: {invoice.addressSnapshot?.phone || '—'}</Typography>
            <Typography variant="body2">
              نشانی: {[invoice.addressSnapshot?.state, invoice.addressSnapshot?.city, invoice.addressSnapshot?.address]
                .filter(Boolean)
                .join('، ') || '—'}
            </Typography>
            <Typography variant="body2">تعداد ردیف کالا: {invoice.lines.length.toLocaleString('fa-IR')}</Typography>
          </Stack>

          {optionsError ? <Alert severity="error">{optionsError}</Alert> : null}
          {options?.warnings?.length ? (
            <Alert severity="warning">{options.warnings.join('، ')}</Alert>
          ) : null}

          <TextField
            select
            size="small"
            label="فروشگاه تاپین *"
            value={shopId}
            onChange={(event) => {
              setShopId(event.target.value);
              clearQuote();
            }}
            helperText="فروشگاه باید توسط ادمین انتخاب شود."
          >
            <MenuItem value="">انتخاب کنید</MenuItem>
            {options?.shops.map((item) => (
              <MenuItem key={item.id} value={item.id}>
                {item.title}
              </MenuItem>
            ))}
          </TextField>

          <Stack
            spacing={1}
            sx={{ p: 1.25, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}
          >
            <Typography variant="subtitle2" fontWeight={800}>
              وزن کالاها
            </Typography>
            {invoice.lines.map((line) => {
              const key = line.variantId ?? line.sku;
              const count = Math.max(1, line.quantity ?? line.requestedQty ?? 1);
              const weight = key ? itemWeights[key] ?? line.weightGrams ?? 0 : line.weightGrams ?? 0;
              return (
                <Stack
                  key={key || line.id}
                  direction={{ xs: 'column', sm: 'row' }}
                  gap={1}
                  alignItems={{ xs: 'stretch', sm: 'center' }}
                >
                  <Stack sx={{ minWidth: 0, flex: 1 }}>
                    <Typography variant="body2" fontWeight={700} noWrap title={line.title}>
                      {line.title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      تعداد: {count.toLocaleString('fa-IR')} — وزن ردیف: {formatGrams(weight * count)}
                    </Typography>
                  </Stack>
                  <TextField
                    size="small"
                    type="number"
                    label="وزن هر عدد (گرم)"
                    value={weight}
                    onChange={(event) => {
                      if (!key) return;
                      setItemWeights((previous) => ({
                        ...previous,
                        [key]: Math.max(0, Math.round(Number(event.target.value) || 0)),
                      }));
                      clearQuote();
                    }}
                    sx={{ width: { xs: '100%', sm: 180 } }}
                  />
                </Stack>
              );
            })}
            {productWeight > 0 ? (
              <Typography variant="caption" color="text.secondary">
                وزن کالا: {formatGrams(productWeight)}
              </Typography>
            ) : (
              <Alert severity="warning">وزن کالاها ثبت نشده است؛ بدون وزن ثبت تاپین انجام نمی‌شود.</Alert>
            )}
          </Stack>

          <Divider />
          <Typography variant="subtitle2" fontWeight={800}>
            مشخصات بسته‌بندی — ورود اجباری توسط ادمین
          </Typography>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <TextField
              select
              fullWidth
              size="small"
              label="استان *"
              value={provinceCode}
              onChange={(event) => {
                setProvinceCode(Number(event.target.value));
                setCityCode(0);
                clearQuote();
              }}
            >
              <MenuItem value={0}>انتخاب کنید</MenuItem>
              {options?.states.map((item) => (
                <MenuItem key={item.code} value={item.code}>
                  {item.title}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              fullWidth
              size="small"
              label="شهر *"
              value={cityCode}
              onChange={(event) => {
                setCityCode(Number(event.target.value));
                clearQuote();
              }}
            >
              <MenuItem value={0}>انتخاب کنید</MenuItem>
              {cities.map((item) => (
                <MenuItem key={item.code} value={item.code}>
                  {item.title}
                </MenuItem>
              ))}
            </TextField>
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <TextField
              select
              fullWidth
              size="small"
              label="ابعاد/جعبه *"
              value={boxId}
              onChange={(event) => {
                setBoxId(Number(event.target.value));
                clearQuote();
              }}
            >
              <MenuItem value={0}>انتخاب کنید</MenuItem>
              {options?.boxes.map((item) => (
                <MenuItem key={item.pk} value={item.pk}>
                  {item.title}
                  {item.length && item.width && item.height
                    ? ` — ${item.length}×${item.width}×${item.height} سانتی‌متر`
                    : ''}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              fullWidth
              size="small"
              type="number"
              label="وزن بسته‌بندی (گرم) *"
              value={packageWeight}
              onChange={(event) => {
                setPackageWeight(event.target.value === '' ? '' : Math.max(0, Number(event.target.value)));
                clearQuote();
              }}
              inputProps={{ min: 0 }}
            />
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <TextField
              select
              fullWidth
              size="small"
              label="نوع سرویس *"
              value={orderType}
              onChange={(event) => {
                setOrderType(event.target.value === '' ? '' : (Number(event.target.value) as 1 | 3 | 5));
                clearQuote();
              }}
            >
              <MenuItem value="">انتخاب کنید</MenuItem>
              <MenuItem value={1}>پیشتاز</MenuItem>
              <MenuItem value={3}>ویژه</MenuItem>
              <MenuItem value={5}>اکسپرس</MenuItem>
            </TextField>
            <TextField
              select
              fullWidth
              size="small"
              label="نوع بسته‌بندی *"
              value={packetType}
              onChange={(event) => {
                setPacketType(event.target.value === '' ? '' : (Number(event.target.value) as 1 | 2 | 3));
                clearQuote();
              }}
            >
              <MenuItem value="">انتخاب کنید</MenuItem>
              <MenuItem value={1}>پاکت</MenuItem>
              <MenuItem value={2}>بسته</MenuItem>
              <MenuItem value={3}>پاکت جوف</MenuItem>
            </TextField>
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <TextField
              select
              fullWidth
              size="small"
              label="محتوای مرسوله *"
              value={contentType}
              onChange={(event) => {
                setContentType(event.target.value === '' ? '' : (Number(event.target.value) as 1 | 2 | 3 | 4));
                clearQuote();
              }}
            >
              <MenuItem value="">انتخاب کنید</MenuItem>
              <MenuItem value={1}>عادی</MenuItem>
              <MenuItem value={2}>مایعات</MenuItem>
              <MenuItem value={3}>شکستنی</MenuItem>
              <MenuItem value={4}>سایر</MenuItem>
            </TextField>
            <TextField
              select
              fullWidth
              size="small"
              label="بیمه *"
              value={hasInsurance === null ? '' : hasInsurance ? 'yes' : 'no'}
              onChange={(event) => {
                setHasInsurance(event.target.value === '' ? null : event.target.value === 'yes');
                clearQuote();
              }}
            >
              <MenuItem value="">انتخاب کنید</MenuItem>
              <MenuItem value="yes">با بیمه</MenuItem>
              <MenuItem value="no">بدون بیمه</MenuItem>
            </TextField>
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <TextField
              select
              fullWidth
              size="small"
              label="نوع پرداخت"
              value={payType}
              onChange={(event) => {
                setPayType(event.target.value === '' ? '' : (Number(event.target.value) as 0 | 1 | 2 | 3));
                clearQuote();
              }}
            >
              <MenuItem value="">مطابق سفارش</MenuItem>
              <MenuItem value={0}>پرداخت در محل</MenuItem>
              <MenuItem value={1}>آنلاین</MenuItem>
              <MenuItem value={2}>پس‌کرایه</MenuItem>
              <MenuItem value={3}>ارسال رایگان</MenuItem>
            </TextField>
            <TextField
              select
              fullWidth
              size="small"
              label="وضعیت ثبت در تاپین *"
              value={registerType}
              onChange={(event) => {
                setRegisterType(event.target.value === '' ? '' : (Number(event.target.value) as 0 | 1 | 2));
                clearQuote();
              }}
            >
              <MenuItem value="">انتخاب کنید</MenuItem>
              <MenuItem value={0}>تحت بررسی</MenuItem>
              <MenuItem value={1}>آماده چاپ</MenuItem>
              <MenuItem value={2}>آماده ارسال</MenuItem>
            </TextField>
          </Stack>

          <FormControlLabel
            control={
              <Switch
                checked={parcelTurning}
                disabled={kioskId === ''}
                onChange={(event) => {
                  setParcelTurning(event.target.checked);
                  clearQuote();
                }}
              />
            }
            label="مرسوله قابلیت چرخش دارد (برای لاکر)"
          />

          <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
            <TextField
              fullWidth
              size="small"
              type="number"
              label="هزینه بسته‌بندی (تومان، اختیاری)"
              value={packagingPriceToman}
              onChange={(event) => {
                setPackagingPriceToman(event.target.value === '' ? '' : Math.max(0, Number(event.target.value)));
                clearQuote();
              }}
            />
            <TextField
              fullWidth
              size="small"
              type="number"
              label="کد ارائه‌دهنده (اختیاری)"
              value={presenterCode}
              onChange={(event) => {
                setPresenterCode(event.target.value);
                clearQuote();
              }}
            />
            <TextField
              fullWidth
              size="small"
              type="number"
              label="کد کارمند (اختیاری)"
              value={employeeCode}
              onChange={(event) => {
                setEmployeeCode(event.target.value === '' ? '' : Number(event.target.value));
                clearQuote();
              }}
            />
          </Stack>

          {payType === 0 ? (
            <TextField
              size="small"
              type="number"
              label="پیش‌پرداخت پرداخت در محل (تومان، اختیاری)"
              value={prePaidPriceToman}
              onChange={(event) => {
                setPrePaidPriceToman(event.target.value === '' ? '' : Math.max(0, Number(event.target.value)));
                clearQuote();
              }}
            />
          ) : null}

          <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
            <Button
              variant="outlined"
              disabled={!provinceCode || !cityCode || !shopId || loading}
              onClick={loadKiosks}
            >
              دریافت لاکرها
            </Button>
            {kiosks.length ? (
              <TextField
                select
                fullWidth
                size="small"
                label="لاکر مقصد (اختیاری)"
                value={kioskId}
                onChange={(event) => {
                  setKioskId(event.target.value === '' ? '' : Number(event.target.value));
                  clearQuote();
                }}
              >
                <MenuItem value="">بدون لاکر</MenuItem>
                {kiosks.map((item) => (
                  <MenuItem key={item.pk} value={item.pk}>
                    {item.company} — {item.address}
                  </MenuItem>
                ))}
              </TextField>
            ) : null}
          </Stack>

          {quote ? (
            <Alert severity="success">
              هزینه ارسال: {formatPrice(quote.total_send_price ?? quote.send_price)} — مبلغ کل: {formatPrice(quote.total_price)} — وزن کل: {formatGrams(quote.total_weight)}
            </Alert>
          ) : null}
          {quote && !quoteIsCurrent ? (
            <Alert severity="warning">مشخصات بسته‌بندی تغییر کرده است؛ برای ثبت، دوباره استعلام بگیرید.</Alert>
          ) : null}

          {!ready ? (
            <Alert severity="warning">برای استعلام، فروشگاه، مقصد، جعبه، وزن بسته، نوع‌ها، بیمه و وزن کالا را تکمیل کنید.</Alert>
          ) : null}
          <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
            <Button disabled={!ready || loading} variant="outlined" onClick={() => run('quote')}>
              استعلام قیمت
            </Button>
            <Button
              disabled={!ready || !quoteIsCurrent || loading}
              variant="contained"
              onClick={() =>
                window.confirm('مشخصات مشتری و بسته‌بندی تأیید و مرسوله در تاپین ثبت شود؟') && run('register')
              }
            >
              ثبت مرسوله در تاپین
            </Button>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}

export default function TapinShipmentCard(props: Props) {
  return useTapinShipmentCardView(props);
}
