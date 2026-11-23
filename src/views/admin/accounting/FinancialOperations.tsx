'use client';

import { useCallback, type ReactNode } from 'react';
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
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import UndoRoundedIcon from '@mui/icons-material/UndoRounded';

import { money, percent } from './financial-operations-utils';
import { FinancialExportActions } from './components/FinancialExportActions';
import { FinancialStatementOverview } from './components/FinancialStatementOverview';
import { FinancialTabs } from './components/FinancialTabs';
import FinancialField from './components/FinancialField';
import { useFinancialOperations } from './useFinancialOperations';

import type { FinancialData } from './financial-operations-types';
import { DonutChart, FloatingTrendChart } from './components/FinancialCharts';

export default function FinancialOperations({ from, to }: { from?: string; to?: string }) {
  const model = useFinancialOperations({ from, to });
  const { tab, setTab, data, error, form, setForm } = model;
  const field = useCallback(
    (name: string, label: string, type = 'text') => (
      <FinancialField form={form} setForm={setForm} name={name} label={label} type={type} />
    ),
    [form, setForm],
  );
  const viewModel = { ...model, field };
  return (
    <Card variant="outlined">
      <CardHeader
        title="عملیات و دفاتر مالی"
        action={<FinancialExportActions from={from} to={to} />}
      />
      <FinancialTabs value={tab} onChange={setTab} />
      <CardContent>
        {error ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        ) : null}
        {!data ? (
          <Typography color="text.secondary">در حال دریافت اطلاعات مالی...</Typography>
        ) : null}

        {data && tab === 'statements' ? (
          <FinancialStatements model={{ ...viewModel, data }} />
        ) : null}

        {data && tab === 'journal' ? <FinancialJournal model={{ ...viewModel, data }} /> : null}

        {data && tab === 'expense' ? <FinancialExpenses model={{ ...viewModel, data }} /> : null}

        {data && tab === 'settlement' ? (
          <FinancialSettlements model={{ ...viewModel, data }} />
        ) : null}

        {data && tab === 'cash' ? <FinancialCashAccounts model={{ ...viewModel, data }} /> : null}

        {data && tab === 'journal' ? <FinancialBulkPosting model={{ ...viewModel, data }} /> : null}

        {data && tab === 'period' ? <FinancialPeriods model={{ ...viewModel, data }} /> : null}
      </CardContent>
    </Card>
  );
}

type FinancialModel = ReturnType<typeof useFinancialOperations> & {
  data: FinancialData;
  field: (name: string, label: string, type?: string) => ReactNode;
};

function FinancialStatements({ model }: { model: FinancialModel }) {
  const { data } = model;
  return (
    <Stack gap={2}>
      <FinancialStatementOverview data={data} />
      <FinancialStatementCharts model={model} />
      {(data.issues?.length ?? 0) > 0 ? <FinancialIssues model={model} /> : null}
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>کد</TableCell>
              <TableCell>حساب</TableCell>
              <TableCell>بدهکار</TableCell>
              <TableCell>بستانکار</TableCell>
              <TableCell>مانده</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.trialBalance.map((row) => (
              <TableRow key={row.code}>
                <TableCell>{row.code}</TableCell>
                <TableCell>{row.name}</TableCell>
                <TableCell>{money(row.debit)}</TableCell>
                <TableCell>{money(row.credit)}</TableCell>
                <TableCell>{money(row.balance)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Stack>
  );
}

function FinancialJournal({ model }: { model: FinancialModel }) {
  const { data, busy, form, setForm, submit, field } = model;
  return (
    <Stack gap={2}>
      <Stack direction={{ xs: 'column', md: 'row' }} gap={1}>
        {field('accountCode', 'کد سرفصل')}
        {field('accountName', 'نام سرفصل')}
        <TextField
          select
          size="small"
          label="ماهیت"
          value={form.accountType ?? 'asset'}
          onChange={(event) =>
            setForm((current) => ({ ...current, accountType: event.target.value }))
          }
        >
          <MenuItem value="asset">دارایی</MenuItem>
          <MenuItem value="liability">بدهی</MenuItem>
          <MenuItem value="equity">حقوق مالکانه</MenuItem>
          <MenuItem value="revenue">درآمد</MenuItem>
          <MenuItem value="expense">هزینه</MenuItem>
        </TextField>
        <Button
          disabled={busy}
          variant="outlined"
          onClick={() =>
            void submit({
              action: 'account',
              code: form.accountCode,
              name: form.accountName,
              type: form.accountType ?? 'asset',
            })
          }
        >
          افزودن سرفصل
        </Button>
      </Stack>
      <Stack direction={{ xs: 'column', md: 'row' }} gap={1}>
        {field('date', 'تاریخ', 'date')}
        {field('description', 'شرح سند')}
        {field('debitCode', 'کد بدهکار')}
        {field('creditCode', 'کد بستانکار')}
        {field('amount', 'مبلغ', 'number')}
        <Button
          disabled={busy}
          variant="contained"
          startIcon={<AddRoundedIcon />}
          onClick={() =>
            void submit({
              action: 'journal',
              date: form.date,
              description: form.description,
              lines: [
                { accountCode: form.debitCode, debit: Number(form.amount) },
                { accountCode: form.creditCode, credit: Number(form.amount) },
              ],
            })
          }
        >
          ثبت سند
        </Button>
      </Stack>
      <Stack direction={{ xs: 'column', md: 'row' }} gap={1} alignItems={{ md: 'center' }}>
        {field('statementAccountCode', 'کد حساب برای گردش')}
        <Button
          component="a"
          href={`/api/admin/accounting/operations?format=account-statement-csv&accountCode=${encodeURIComponent(
            form.statementAccountCode ?? '',
          )}`}
          startIcon={<DownloadRoundedIcon />}
        >
          CSV گردش حساب
        </Button>
      </Stack>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>شماره</TableCell>
              <TableCell>تاریخ</TableCell>
              <TableCell>شرح</TableCell>
              <TableCell>وضعیت</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {data.journals.map((item) => (
              <TableRow key={item._id}>
                <TableCell>{item.number}</TableCell>
                <TableCell>
                  {new Date(item.date).toLocaleDateString('fa-IR-u-ca-persian')}
                </TableCell>
                <TableCell>{item.description}</TableCell>
                <TableCell>
                  <Chip size="small" label={item.status} />
                </TableCell>
                <TableCell>
                  <Button
                    disabled={item.status !== 'posted' || busy}
                    startIcon={<UndoRoundedIcon />}
                    onClick={() => void submit({ action: 'reverse-journal', id: item._id })}
                  >
                    اصلاح
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Stack>
  );
}

function FinancialExpenses({ model }: { model: FinancialModel }) {
  const { data, busy, form, submit, field } = model;
  return (
    <Stack gap={2}>
      <Stack direction={{ xs: 'column', md: 'row' }} gap={1}>
        {field('title', 'عنوان')}
        {field('category', 'دسته')}
        {field('amount', 'مبلغ', 'number')}
        {field('date', 'تاریخ', 'date')}
        {field('reference', 'مرجع')}
        <Button
          disabled={busy}
          variant="contained"
          onClick={() => void submit({ action: 'expense', ...form, amount: Number(form.amount) })}
        >
          ثبت و صدور سند
        </Button>
      </Stack>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>تاریخ</TableCell>
              <TableCell>عنوان</TableCell>
              <TableCell>دسته</TableCell>
              <TableCell>مبلغ</TableCell>
              <TableCell>وضعیت</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.expenses.map((item) => (
              <TableRow key={item._id}>
                <TableCell>
                  {new Date(item.date).toLocaleDateString('fa-IR-u-ca-persian')}
                </TableCell>
                <TableCell>{item.title}</TableCell>
                <TableCell>{item.category}</TableCell>
                <TableCell>{money(item.amount)}</TableCell>
                <TableCell>{item.status}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Stack>
  );
}

function FinancialSettlements({ model }: { model: FinancialModel }) {
  const {
    data,
    busy,
    form,
    settlementLines,
    digikalaSettlement,
    submit,
    readSettlementCsv,
    readDigikalaSettlementJson,
    field,
  } = model;
  return (
    <Stack gap={2}>
      <Alert severity="info">
        صورتحساب رسمی دیجی‌کالا طبق مستندات OpenAPI از فیلدهای invoice/details خوانده می‌شود و به
        تسویه قابل سند تبدیل می‌شود.
      </Alert>
      <Stack direction={{ xs: 'column', md: 'row' }} gap={1}>
        {field('provider', 'ارائه‌دهنده')}
        {field('reference', 'شماره تسویه')}
        {field('grossAmount', 'ناخالص', 'number')}
        {field('feeAmount', 'کارمزد', 'number')}
        {field('taxAmount', 'مالیات', 'number')}
        {field('settledAt', 'تاریخ', 'date')}
        <Button component="label" variant="outlined">
          فایل CSV
          <input
            hidden
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => void readSettlementCsv(event.target.files?.[0])}
          />
        </Button>
        <Button
          disabled={busy}
          variant="contained"
          onClick={() =>
            void submit({
              action: 'settlement',
              ...form,
              periodFrom: form.settledAt,
              periodTo: form.settledAt,
              grossAmount: Number(form.grossAmount),
              feeAmount: Number(form.feeAmount || 0),
              taxAmount: Number(form.taxAmount || 0),
              lines: settlementLines,
            })
          }
        >
          ثبت تسویه
        </Button>
      </Stack>
      {settlementLines.length ? <Chip label={`${settlementLines.length} ردیف برای تطبیق`} /> : null}
      <Stack direction={{ xs: 'column', md: 'row' }} gap={1} alignItems={{ md: 'center' }}>
        {field('digikalaVendorId', 'شناسه غرفه دیجی‌کالا')}
        <Button component="label" variant="outlined">
          JSON صورتحساب دیجی‌کالا
          <input
            hidden
            type="file"
            accept="application/json,.json"
            onChange={(event) => void readDigikalaSettlementJson(event.target.files?.[0])}
          />
        </Button>
        <Button
          disabled={busy || !digikalaSettlement}
          variant="contained"
          onClick={() =>
            void submit({
              action: 'digikala-invoice-settlement',
              vendorId: form.digikalaVendorId,
              invoice:
                (digikalaSettlement?.invoice as Record<string, unknown> | undefined) ??
                digikalaSettlement,
              details: digikalaSettlement?.details ?? digikalaSettlement,
            })
          }
        >
          import دیجی‌کالا
        </Button>
        {digikalaSettlement ? <Chip label="فایل دیجی‌کالا آماده import است" /> : null}
      </Stack>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>ارائه‌دهنده</TableCell>
              <TableCell>مرجع</TableCell>
              <TableCell>خالص</TableCell>
              <TableCell>وضعیت</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {data.settlements.map((item) => (
              <TableRow key={item._id}>
                <TableCell>{item.provider}</TableCell>
                <TableCell>{item.reference}</TableCell>
                <TableCell>{money(item.netAmount)}</TableCell>
                <TableCell>{item.status}</TableCell>
                <TableCell>
                  <Button
                    disabled={item.status === 'posted' || busy}
                    onClick={() => void submit({ action: 'post-settlement', id: item._id })}
                  >
                    صدور سند
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Stack>
  );
}

function FinancialCashAccounts({ model }: { model: FinancialModel }) {
  const { data, busy, form, setForm, submit, field } = model;
  return (
    <Stack gap={2}>
      <Stack direction={{ xs: 'column', md: 'row' }} gap={1}>
        {field('name', 'نام حساب')}
        <TextField
          select
          size="small"
          label="نوع"
          value={form.kind ?? 'bank'}
          onChange={(event) => setForm((current) => ({ ...current, kind: event.target.value }))}
        >
          <MenuItem value="bank">بانک</MenuItem>
          <MenuItem value="cash">صندوق</MenuItem>
          <MenuItem value="gateway">درگاه</MenuItem>
          <MenuItem value="marketplace">مارکت‌پلیس</MenuItem>
        </TextField>
        <TextField
          select
          size="small"
          label="سرفصل"
          value={form.accountId ?? ''}
          onChange={(event) =>
            setForm((current) => ({ ...current, accountId: event.target.value }))
          }
        >
          {data.accounts
            .filter((item) => item.type === 'asset')
            .map((item) => (
              <MenuItem key={item._id} value={item._id}>
                {item.code} - {item.name}
              </MenuItem>
            ))}
        </TextField>
        {field('iban', 'شبا')}
        <Button
          disabled={busy}
          variant="contained"
          onClick={() => void submit({ action: 'cash-account', ...form })}
        >
          افزودن
        </Button>
      </Stack>
      {data.cashAccounts.map((item) => (
        <Chip key={item._id} label={`${item.name} - ${item.kind}`} />
      ))}
    </Stack>
  );
}

function FinancialBulkPosting({ model }: { model: FinancialModel }) {
  const { busy, form, setForm, submit } = model;
  return (
    <Stack direction={{ xs: 'column', md: 'row' }} gap={1} sx={{ mt: 2 }}>
      <TextField
        select
        size="small"
        label="پلتفرم برای صدور گروهی"
        value={form.marketplaceChannel ?? ''}
        onChange={(event) =>
          setForm((current) => ({ ...current, marketplaceChannel: event.target.value }))
        }
        sx={{ minWidth: 180 }}
      >
        <MenuItem value="">همه مارکت‌پلیس‌ها</MenuItem>
        <MenuItem value="digikala">دیجی‌کالا</MenuItem>
        <MenuItem value="basalaam">باسلام</MenuItem>
        <MenuItem value="snapp">اسنپ‌شاپ</MenuItem>
      </TextField>
      <Button
        disabled={busy}
        variant="outlined"
        onClick={() =>
          void submit({
            action: 'post-unposted-marketplace-sales',
            channel: form.marketplaceChannel,
            limit: 100,
          })
        }
      >
        صدور سند فروش‌های بدون سند
      </Button>
    </Stack>
  );
}

function FinancialPeriods({ model }: { model: FinancialModel }) {
  const { data, busy, form, submit, field } = model;
  return (
    <Stack gap={2}>
      <Stack direction={{ xs: 'column', md: 'row' }} gap={1}>
        {field('name', 'نام دوره')}
        {field('startsAt', 'شروع', 'date')}
        {field('endsAt', 'پایان', 'date')}
        <Button
          disabled={busy}
          variant="contained"
          onClick={() => void submit({ action: 'period', ...form })}
        >
          ایجاد دوره
        </Button>
      </Stack>
      {data.periods.map((item) => (
        <Stack key={item._id} direction="row" gap={1} alignItems="center">
          <Typography>{item.name}</Typography>
          <Chip size="small" label={item.status} />
          <Button
            disabled={item.status === 'closed' || busy}
            onClick={() => void submit({ action: 'close-period', id: item._id })}
          >
            بستن دوره
          </Button>
        </Stack>
      ))}
    </Stack>
  );
}

function FinancialIssues({ model }: { model: FinancialModel }) {
  const { data, busy, submit } = model;
  return (
    <Card variant="outlined">
      <CardHeader title="هشدارهای قابل پیگیری" />
      <CardContent>
        <Stack gap={1}>
          {data.issues.slice(0, 8).map((issue) => (
            <Stack
              key={issue._id}
              direction={{ xs: 'column', sm: 'row' }}
              justifyContent="space-between"
              gap={1}
              sx={{ p: 1, border: 1, borderColor: 'divider', borderRadius: 1 }}
            >
              <Stack gap={0.5}>
                <Stack direction="row" gap={0.75} alignItems="center" flexWrap="wrap">
                  <Typography fontSize={13} fontWeight={700}>
                    {issue.type}
                  </Typography>
                  <Chip size="small" label={issue.severity} />
                  <Chip size="small" color="info" label={issue.status} />
                </Stack>
                <Typography fontSize={13} color="text.secondary">
                  {issue.message ?? issue.entityId}
                </Typography>
                {issue.note ? (
                  <Typography fontSize={12} color="text.secondary">
                    یادداشت: {issue.note}
                  </Typography>
                ) : null}
              </Stack>
              <Stack direction="row" gap={0.5} flexWrap="wrap">
                <Button
                  size="small"
                  disabled={busy}
                  onClick={() =>
                    void submit({
                      action: 'accounting-issue',
                      id: issue._id,
                      status: 'reviewing',
                    })
                  }
                >
                  بررسی
                </Button>
                <Button
                  size="small"
                  disabled={busy}
                  onClick={() =>
                    void submit({
                      action: 'accounting-issue',
                      id: issue._id,
                      status: 'resolved',
                    })
                  }
                >
                  حل شد
                </Button>
                <Button
                  size="small"
                  disabled={busy}
                  onClick={() =>
                    void submit({
                      action: 'accounting-issue',
                      id: issue._id,
                      status: 'ignored',
                    })
                  }
                >
                  نادیده
                </Button>
              </Stack>
            </Stack>
          ))}
        </Stack>
      </CardContent>
    </Card>
  );
}

function FinancialStatementCharts({ model }: { model: FinancialModel }) {
  const { data, statementSlices, settlementSlices } = model;
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', lg: '1.1fr .9fr' },
        gap: 2,
      }}
    >
      <Card variant="outlined">
        <CardHeader
          title="روند زنده سود و هزینه"
          subheader="آخرین ۱۲ نقطه ثبت‌شده در دفتر روزنامه"
        />
        <CardContent>
          <FloatingTrendChart rows={data.trends.slice(-12)} />
        </CardContent>
      </Card>
      <Stack gap={2}>
        <Card variant="outlined">
          <CardHeader title="ترکیب مانده حساب‌ها" />
          <CardContent>
            <DonutChart slices={statementSlices} />
          </CardContent>
        </Card>
        <Card variant="outlined">
          <CardHeader title="وضعیت تسویه‌ها" />
          <CardContent>
            <DonutChart slices={settlementSlices} />
            <Stack direction="row" gap={1} flexWrap="wrap" sx={{ mt: 1 }}>
              <Chip
                size="small"
                label={`ناخالص: ${money(data.settlementSummary?.grossAmount ?? 0)}`}
              />
              <Chip size="small" label={`خالص: ${money(data.settlementSummary?.netAmount ?? 0)}`} />
              <Chip
                size="small"
                label={`کسورات: ${money(
                  (data.settlementSummary?.feeAmount ?? 0) +
                    (data.settlementSummary?.taxAmount ?? 0) +
                    (data.settlementSummary?.otherDeduction ?? 0),
                )}`}
              />
            </Stack>
          </CardContent>
        </Card>
      </Stack>
    </Box>
  );
}
