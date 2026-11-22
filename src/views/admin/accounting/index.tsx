'use client';

import {
  TableContainer,
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import Grid from '@mui/material/Grid';
import { useCallback } from 'react';

import Splash from '@/components/splash';
import JalaliDateField from '@/components/jalali-date-field';
import { formatJalali } from '@/lib/jalali';
import FinancialOperations from './FinancialOperations';
import { BarRow, KpiTile } from './components/AccountingPrimitives';
import AccountingInvoiceRows from './components/AccountingInvoiceRows';
import {
  CHANNELS,
  type ChannelKey,
  type InvoiceRow,
  type ProductRow,
  type Summary,
} from './accounting-types';
import { isoDay, useAccounting } from './useAccounting';

const money = (value: number) => new Intl.NumberFormat('fa-IR').format(Math.round(value || 0));
const count = (value: number) => new Intl.NumberFormat('fa-IR').format(value || 0);

export default function AccountingView() {
  const model = useAccounting();
  const { loading, error, summary } = model;
  return (
    <Stack spacing={2}>
      <AccountingFilters model={model} />

      {error && <Alert severity="error">{error}</Alert>}
      {loading && <Splash />}

      {!loading && summary && (
        <>
          <AccountingTotals model={{ ...model, summary }} />

          <AccountingInsights model={{ ...model, summary }} />

          <AccountingChannels model={{ ...model, summary }} />

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, lg: 7 }}>
              <AccountingBranches model={{ ...model, summary }} />
            </Grid>
            <Grid size={{ xs: 12, lg: 5 }}>
              <AccountingGateways model={{ ...model, summary }} />
            </Grid>
          </Grid>

          <AccountingProducts model={{ ...model, summary }} />

          <AccountingInvoices model={{ ...model, summary }} />
        </>
      )}
      <FinancialOperations from={model.from} to={model.to} />
    </Stack>
  );
}

type AccountingModel = ReturnType<typeof useAccounting>;
type LoadedAccountingModel = AccountingModel & { summary: Summary };

function AccountingFilters({ model }: { model: AccountingModel }) {
  const { from, setFrom, to, setTo, channels, setChannels, setInvoicePage, load } = model;
  return (
    <Card variant="outlined">
      <CardHeader
        title="حسابداری و درآمد"
        subheader="همه ارقام به تومان هستند؛ سایت بر مبنای تاریخ پرداخت/بازپرداخت و مارکت‌پلیس‌ها بر مبنای تاریخ ثبت داده محاسبه می‌شوند."
      />
      <CardContent>
        <Stack direction="row" gap={0.75} flexWrap="wrap" mb={2}>
          {[
            ['امروز', 0],
            ['۷ روز اخیر', -6],
            ['۳۰ روز اخیر', -30],
            ['۹۰ روز اخیر', -90],
          ].map(([label, offset]) => (
            <Button
              key={label}
              size="small"
              variant="outlined"
              onClick={() => {
                setInvoicePage(0);
                setFrom(isoDay(Number(offset)));
                setTo(isoDay(1));
              }}
            >
              {label}
            </Button>
          ))}
        </Stack>
        <Stack direction={{ xs: 'column', md: 'row' }} gap={2} alignItems={{ md: 'center' }}>
          <JalaliDateField
            label="از تاریخ"
            value={from}
            onChange={(value) => {
              setInvoicePage(0);
              setFrom(value);
            }}
            size="small"
          />
          <JalaliDateField
            label="تا تاریخ"
            value={to}
            onChange={(value) => {
              setInvoicePage(0);
              setTo(value);
            }}
            size="small"
            helperText="بازه تا ابتدای این روز است"
          />
          <Stack direction="row" gap={0.75} flexWrap="wrap">
            {CHANNELS.map((channel) => {
              const selected = channels.includes(channel.key);
              return (
                <Chip
                  key={channel.key}
                  label={channel.label}
                  clickable
                  variant={selected ? 'filled' : 'outlined'}
                  color={selected ? 'secondary' : 'default'}
                  onClick={() => {
                    setInvoicePage(0);
                    setChannels((current) =>
                      current.includes(channel.key)
                        ? current.filter((key) => key !== channel.key)
                        : [...current, channel.key],
                    );
                  }}
                />
              );
            })}
          </Stack>
          <Button variant="contained" onClick={() => void load()} sx={{ flexShrink: 0 }}>
            بروزرسانی
          </Button>
        </Stack>
        <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 1 }}>
          بازهٔ فعلی: {formatJalali(from)} تا {formatJalali(to)} · بدون انتخاب کانال، همه کانال‌ها
          محاسبه می‌شوند.
        </Typography>
      </CardContent>
    </Card>
  );
}

function AccountingTotals({ model }: { model: LoadedAccountingModel }) {
  const { summary } = model;
  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 6, md: 3 }}>
        <KpiTile label="درآمد ناخالص" value={money(summary.totals.revenue)} hint="تومان" />
      </Grid>
      <Grid size={{ xs: 6, md: 3 }}>
        <KpiTile
          label="فروش خالص"
          value={money(summary.totals.netSales)}
          hint="فروش قطعی پس از کسر برگشتی؛ نه سود خالص"
        />
      </Grid>
      <Grid size={{ xs: 6, md: 3 }}>
        <KpiTile
          label="تعداد سفارش"
          value={count(summary.totals.orderCount)}
          hint={`${count(summary.totals.itemCount)} قلم کالا`}
        />
      </Grid>
      <Grid size={{ xs: 6, md: 3 }}>
        <KpiTile
          label="برگشت از فروش"
          value={money(summary.totals.returnedRevenue)}
          hint={`${count(summary.totals.returnedCount)} مورد`}
        />
      </Grid>
    </Grid>
  );
}

function AccountingInsights({ model }: { model: LoadedAccountingModel }) {
  const { summary } = model;
  const recognized = Math.max(summary.totals.revenue, 1);
  const returnRate = (summary.totals.returnedRevenue / recognized) * 100;
  const avgOrder = summary.totals.orderCount
    ? summary.totals.netSales / summary.totals.orderCount
    : 0;
  const unsettled = summary.gateways.reduce((sum, gateway) => sum + gateway.unsettledAmount, 0);
  const max = Math.max(1, ...summary.channels.map((channel) => channel.revenue));
  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12, lg: 6 }}>
        <Card variant="outlined" sx={{ height: '100%' }}>
          <CardHeader
            title="ترکیب فروش و کیفیت درآمد"
            subheader="سهم هر کانال از فروش قطعی در بازهٔ انتخابی"
          />
          <CardContent>
            <Stack gap={1.5}>
              {summary.channels.map((channel) => (
                <BarRow
                  key={channel.channel}
                  label={channel.label}
                  value={channel.revenue}
                  max={max}
                  caption={`${money(channel.revenue)} تومان — ${((channel.revenue / recognized) * 100).toFixed(1)}٪`}
                />
              ))}
            </Stack>
          </CardContent>
        </Card>
      </Grid>
      <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
        <KpiTile label="میانگین ارزش سفارش" value={money(avgOrder)} hint="تومان از فروش خالص" />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
        <KpiTile
          label="نرخ برگشت"
          value={`${returnRate.toFixed(1)}٪`}
          hint={`${money(summary.totals.returnedRevenue)} تومان برگشتی`}
        />
      </Grid>
      {unsettled > 0 ? (
        <Grid size={{ xs: 12 }}>
          <Alert severity="warning">
            {money(unsettled)} تومان از وصول درگاه‌ها هنوز تسویه‌نشده است؛ جزئیات در جدول وصول قابل
            پیگیری است.
          </Alert>
        </Grid>
      ) : null}
    </Grid>
  );
}

function AccountingChannels({ model }: { model: LoadedAccountingModel }) {
  const { summary, maxChannelRevenue } = model;
  return (
    <Card variant="outlined">
      <CardHeader title="درآمد به تفکیک کانال فروش" />
      <CardContent>
        <Stack gap={2}>
          {summary.channels.map((channel) => (
            <BarRow
              key={channel.channel}
              label={channel.label}
              value={channel.revenue}
              max={maxChannelRevenue}
              caption={`${money(channel.revenue)} تومان — ${count(channel.orderCount)} سفارش`}
            />
          ))}
        </Stack>

        <TableContainer>
          <Table size="small" sx={{ mt: 3 }}>
            <TableHead>
              <TableRow>
                <TableCell>کانال</TableCell>
                <TableCell>سفارش</TableCell>
                <TableCell>اقلام</TableCell>
                <TableCell>درآمد</TableCell>
                <TableCell>برگشت</TableCell>
                <TableCell>وضعیت‌ها</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {summary.channels.map((channel) => (
                <TableRow key={channel.channel}>
                  <TableCell>{channel.label}</TableCell>
                  <TableCell>{count(channel.orderCount)}</TableCell>
                  <TableCell>{count(channel.itemCount)}</TableCell>
                  <TableCell>{money(channel.revenue)}</TableCell>
                  <TableCell>{money(channel.returnedRevenue)}</TableCell>
                  <TableCell>
                    {/* Raw statuses, so an unmapped marketplace vocabulary is
                            visible instead of silently folded into revenue. */}
                    <Stack direction="row" gap={0.5} flexWrap="wrap">
                      {Object.entries(channel.statusBreakdown).map(([status, value]) => (
                        <Chip key={status} size="small" label={`${status}: ${count(value)}`} />
                      ))}
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>
    </Card>
  );
}

function AccountingBranches({ model }: { model: LoadedAccountingModel }) {
  const { summary } = model;
  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardHeader
        title="تفکیک دقیق شعبه و غرفه"
        subheader="هر شعبه سایت و هر vendorId مارکت‌پلیس جداگانه محاسبه می‌شود."
      />
      <CardContent>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>پلتفرم</TableCell>
                <TableCell>شعبه/غرفه</TableCell>
                <TableCell>سفارش</TableCell>
                <TableCell>اقلام</TableCell>
                <TableCell>درآمد</TableCell>
                <TableCell>برگشت</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(summary.branches ?? []).map((branch) => (
                <TableRow key={`${branch.channel}:${branch.branchId}`}>
                  <TableCell>{branch.label}</TableCell>
                  <TableCell>{branch.branchLabel}</TableCell>
                  <TableCell>{count(branch.orderCount)}</TableCell>
                  <TableCell>{count(branch.itemCount)}</TableCell>
                  <TableCell>{money(branch.revenue)}</TableCell>
                  <TableCell>{money(branch.returnedRevenue)}</TableCell>
                </TableRow>
              ))}
              {(summary.branches ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6}>
                    <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
                      داده‌ای برای تفکیک شعبه در این بازه نیست.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>
    </Card>
  );
}

function AccountingGateways({ model }: { model: LoadedAccountingModel }) {
  const { summary } = model;
  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardHeader
        title="وصول درگاه‌های پرداخت"
        subheader="برای هر فاکتور فقط آخرین تراکنش موفق لحاظ و با مبلغ فاکتور مغایرت‌گیری می‌شود."
      />
      <CardContent>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>درگاه</TableCell>
                <TableCell>شعبه</TableCell>
                <TableCell>تراکنش</TableCell>
                <TableCell>وصول</TableCell>
                <TableCell>تسویه‌نشده</TableCell>
                <TableCell>مغایرت</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(summary.gateways ?? []).map((gateway) => (
                <TableRow key={`${gateway.branchId}:${gateway.gateway}`}>
                  <TableCell>{gateway.label}</TableCell>
                  <TableCell>{gateway.branchLabel}</TableCell>
                  <TableCell>{count(gateway.transactionCount)}</TableCell>
                  <TableCell>{money(gateway.amount)}</TableCell>
                  <TableCell>{money(gateway.unsettledAmount)}</TableCell>
                  <TableCell>{money(gateway.discrepancy)}</TableCell>
                </TableRow>
              ))}
              {(summary.gateways ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6}>
                    <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
                      تراکنش تاییدشده‌ای برای درگاه‌ها در این بازه نیست.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>
    </Card>
  );
}

function AccountingProducts({ model }: { model: LoadedAccountingModel }) {
  const { products, maxProductRevenue } = model;
  return (
    <Card variant="outlined">
      <CardHeader
        title="درآمد و تعداد فروش هر کالا"
        subheader="تخفیف و ارسال متناسب با مبلغ هر ردیف تخصیص یافته‌اند؛ کالاهای مارکت‌پلیس از روی بارکد متصل می‌شوند."
      />
      <CardContent>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>کالا</TableCell>
                <TableCell>تعداد فروش</TableCell>
                <TableCell>دفعات سفارش</TableCell>
                <TableCell>فروش تخصیص‌یافته</TableCell>
                <TableCell>بهای تمام‌شده</TableCell>
                <TableCell>سود ناخالص</TableCell>
                <TableCell>تفکیک کانال</TableCell>
                <TableCell sx={{ minWidth: 160 }}>سهم</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {products.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8}>
                    <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
                      در این بازه فروشی ثبت نشده است.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                products.map((product) => (
                  <TableRow key={product.productId ?? product.title}>
                    <TableCell sx={{ maxWidth: 320 }}>{product.title}</TableCell>
                    <TableCell>{count(product.quantity)}</TableCell>
                    <TableCell>{count(product.orderLines)}</TableCell>
                    <TableCell>{money(product.revenue)}</TableCell>
                    <TableCell>{money(product.cost)}</TableCell>
                    <TableCell>{money(product.grossProfit)}</TableCell>
                    <TableCell>
                      <Stack direction="row" gap={0.5} flexWrap="wrap">
                        {CHANNELS.filter((channel) => product.byChannel[channel.key]).map(
                          (channel) => {
                            const detail = product.byChannel[channel.key]!;
                            return (
                              <Chip
                                key={channel.key}
                                size="small"
                                variant="outlined"
                                label={`${channel.label}: ${count(detail.quantity)} / ${money(detail.revenue)}`}
                              />
                            );
                          },
                        )}
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Box
                        sx={{
                          height: 8,
                          borderRadius: 999,
                          bgcolor: 'grey.100',
                          overflow: 'hidden',
                        }}
                      >
                        <Box
                          sx={{
                            width: `${(product.revenue / maxProductRevenue) * 100}%`,
                            height: '100%',
                            bgcolor: 'success.main',
                          }}
                        />
                      </Box>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>
    </Card>
  );
}

function AccountingInvoices({ model }: { model: LoadedAccountingModel }) {
  const {
    invoices,
    invoicePage,
    setInvoicePage,
    invoiceSearch,
    setInvoiceSearch,
    invoiceStatus,
    setInvoiceStatus,
    invoiceSort,
    setInvoiceSort,
  } = model;
  return (
    <Card variant="outlined">
      <CardHeader
        title="فاکتورها"
        subheader={`${count(invoices.total)} فاکتور در این بازه — روی هر ردیف بزنید تا اقلامش باز شود.`}
      />
      <CardContent>
        <Stack direction={{ xs: 'column', md: 'row' }} gap={1} mb={2}>
          <TextField
            size="small"
            label="جستجوی فاکتور یا مشتری"
            value={invoiceSearch}
            onChange={(event) => {
              setInvoicePage(0);
              setInvoiceSearch(event.target.value);
            }}
          />
          <TextField
            select
            size="small"
            label="وضعیت"
            value={invoiceStatus}
            onChange={(event) => {
              setInvoicePage(0);
              setInvoiceStatus(event.target.value);
            }}
            sx={{ minWidth: 140 }}
          >
            <MenuItem value="">همه</MenuItem>
            <MenuItem value="paid">پرداخت‌شده</MenuItem>
            <MenuItem value="pending">در انتظار</MenuItem>
            <MenuItem value="refunded">بازپرداخت</MenuItem>
            <MenuItem value="canceled">لغو</MenuItem>
          </TextField>
          <TextField
            select
            size="small"
            label="مرتب‌سازی"
            value={invoiceSort}
            onChange={(event) => {
              setInvoicePage(0);
              setInvoiceSort(event.target.value);
            }}
            sx={{ minWidth: 160 }}
          >
            <MenuItem value="financial_desc">جدیدترین</MenuItem>
            <MenuItem value="financial_asc">قدیمی‌ترین</MenuItem>
            <MenuItem value="amount_desc">بیشترین مبلغ</MenuItem>
            <MenuItem value="amount_asc">کمترین مبلغ</MenuItem>
          </TextField>
          <Button onClick={() => window.print()}>چاپ</Button>
        </Stack>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell />
                <TableCell>شماره</TableCell>
                <TableCell>تاریخ مالی</TableCell>
                <TableCell>مشتری</TableCell>
                <TableCell>وضعیت</TableCell>
                <TableCell>وصول</TableCell>
                <TableCell>مبلغ کل</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {invoices.rows.map((invoice) => (
                // Keyed Fragment, not a bare `<>`: each invoice renders two
                // sibling rows, and without a key on the wrapper React cannot
                // match them across re-renders — the expanded row would follow
                // the wrong invoice once the list re-sorts.
                <AccountingInvoiceRows
                  key={invoice.id}
                  invoice={invoice}
                  open={model.openInvoice === invoice.id}
                  onToggle={() =>
                    model.setOpenInvoice((current) => (current === invoice.id ? null : invoice.id))
                  }
                  onRefund={() => void model.requestRefund(invoice)}
                />
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <Stack direction="row" justifyContent="flex-end" gap={1} mt={2}>
          <Button disabled={invoicePage === 0} onClick={() => setInvoicePage((p) => p - 1)}>
            قبلی
          </Button>
          <Button
            disabled={(invoicePage + 1) * 50 >= invoices.total}
            onClick={() => setInvoicePage((p) => p + 1)}
          >
            بعدی
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
}
