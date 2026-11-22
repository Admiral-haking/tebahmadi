import {
  Alert,
  Box,
  Card,
  CardContent,
  CardHeader,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';

import { money } from '../financial-operations-utils';
import type { FinancialData } from '../financial-operations-types';

type FinancialStatementOverviewProps = { data: FinancialData };

export function FinancialStatementOverview({ data }: FinancialStatementOverviewProps) {
  return (
    <>
      {(data.issues?.length ?? data.alerts.length) ? (
        <Alert severity="warning">
          {data.issues?.length ?? data.alerts.length} مغایرت نیازمند بررسی است.
        </Alert>
      ) : null}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(6, 1fr)' },
          gap: 1.5,
        }}
      >
        <Metric label="درآمد" value={data.profitAndLoss.revenue} tone="success" />
        <Metric label="هزینه" value={data.profitAndLoss.expense} tone="danger" />
        <Metric label="سود خالص" value={data.profitAndLoss.netProfit} tone="info" />
        <Metric label="دارایی" value={data.balanceSheet.assets} tone="asset" />
        <Metric label="دریافتنی" value={data.receivables} tone="warning" />
        <Metric label="پرداختنی" value={data.payables} tone="neutral" />
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '.8fr 1.2fr' }, gap: 2 }}>
        <Card variant="outlined">
          <CardHeader title="جریان نقدی" />
          <CardContent>
            <Stack gap={1.25}>
              <Metric label="ورودی نقد" value={data.cashFlow?.inflow ?? 0} tone="success" />
              <Metric label="خروجی نقد" value={data.cashFlow?.outflow ?? 0} tone="danger" />
              <Metric label="خالص نقد" value={data.cashFlow?.net ?? 0} tone="info" />
            </Stack>
          </CardContent>
        </Card>
        <Card variant="outlined">
          <CardHeader title="مانده نزد درگاه‌ها" />
          <CardContent>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>ارائه‌دهنده</TableCell>
                    <TableCell>شعبه</TableCell>
                    <TableCell>تراکنش</TableCell>
                    <TableCell>وصول</TableCell>
                    <TableCell>تسویه‌شده</TableCell>
                    <TableCell>در راه</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(data.gatewaySubledger ?? []).map((row) => (
                    <TableRow key={`${row.provider}:${row.branchId}`}>
                      <TableCell>{row.provider}</TableCell>
                      <TableCell>{row.branchId}</TableCell>
                      <TableCell>{row.transactions}</TableCell>
                      <TableCell>{money(row.collected)}</TableCell>
                      <TableCell>{money(row.settled)}</TableCell>
                      <TableCell>{money(row.inTransit)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      </Box>
    </>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'success' | 'danger' | 'info' | 'asset' | 'warning' | 'neutral';
}) {
  const colors = {
    success: ['#ecfdf5', '#047857'],
    danger: ['#fef2f2', '#b91c1c'],
    info: ['#eff6ff', '#1d4ed8'],
    asset: ['#f0f9ff', '#0369a1'],
    warning: ['#fffbeb', '#b45309'],
    neutral: ['#f8fafc', '#475569'],
  }[tone];
  return (
    <Box
      sx={{
        p: 1.5,
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        bgcolor: colors[0],
        minHeight: 104,
      }}
    >
      <Typography fontSize={12} color="text.secondary">
        {label}
      </Typography>
      <Typography fontSize={20} fontWeight={800} color={colors[1]} sx={{ mt: 1 }}>
        {money(value)} تومان
      </Typography>
    </Box>
  );
}
