'use client';

import {
  Box,
  Button,
  Chip,
  Collapse,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import { Fragment } from 'react';

import type { InvoiceRow } from '../accounting-types';

const money = (value: number) => new Intl.NumberFormat('fa-IR').format(Math.round(value || 0));
const count = (value: number) => new Intl.NumberFormat('fa-IR').format(value || 0);

type Props = {
  invoice: InvoiceRow;
  open: boolean;
  onToggle: () => void;
  onRefund: () => void;
};

export default function AccountingInvoiceRows({ invoice, open, onToggle, onRefund }: Props) {
  return (
    <Fragment>
      <TableRow hover>
        <TableCell sx={{ width: 48 }}>
          <IconButton size="small" aria-label="نمایش اقلام فاکتور" onClick={onToggle}>
            <ExpandMoreRoundedIcon
              sx={{
                transition: 'transform .2s ease',
                transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
              }}
            />
          </IconButton>
        </TableCell>
        <TableCell>{invoice.number}</TableCell>
        <TableCell>
          {new Intl.DateTimeFormat('fa-IR-u-ca-persian', { dateStyle: 'short' }).format(
            new Date(invoice.financialDate),
          )}
        </TableCell>
        <TableCell>{invoice.customer || '—'}</TableCell>
        <TableCell>
          <Chip size="small" label={invoice.status} />
        </TableCell>
        <TableCell>
          <Chip
            size="small"
            color={
              !invoice.payment || invoice.payment.discrepancy !== 0
                ? 'warning'
                : invoice.payment.settledAt
                  ? 'success'
                  : 'info'
            }
            label={
              !invoice.payment
                ? 'بدون تراکنش'
                : invoice.payment.discrepancy !== 0
                  ? 'مغایرت مبلغ'
                  : invoice.payment.settledAt
                    ? 'تسویه‌شده'
                    : 'وصول‌شده'
            }
          />
        </TableCell>
        <TableCell>{money(invoice.grandTotal)}</TableCell>
      </TableRow>
      <TableRow>
        <TableCell colSpan={7} sx={{ py: 0, borderBottom: 0 }}>
          <Collapse in={open} unmountOnExit>
            <Box sx={{ py: 1.5 }}>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>کالا</TableCell>
                      <TableCell>SKU</TableCell>
                      <TableCell>تعداد</TableCell>
                      <TableCell>قیمت واحد</TableCell>
                      <TableCell>جمع</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {invoice.lines.map((line, index) => (
                      <TableRow key={`${line.sku}-${index}`}>
                        <TableCell>
                          {line.title}
                          {line.variantSummary ? (
                            <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                              {line.variantSummary}
                            </Typography>
                          ) : null}
                        </TableCell>
                        <TableCell>{line.sku}</TableCell>
                        <TableCell>{count(line.qty)}</TableCell>
                        <TableCell>{money(line.unitPrice)}</TableCell>
                        <TableCell>{money(line.lineTotal)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              <Stack direction="row" gap={2} flexWrap="wrap" sx={{ mt: 1.5, fontSize: 13 }}>
                <span>جمع اقلام: {money(invoice.subtotal)}</span>
                <span>تخفیف: {money(invoice.discountTotal)}</span>
                <span>ارسال: {money(invoice.shippingTotal)}</span>
                <strong>پرداختی: {money(invoice.grandTotal)}</strong>
                {invoice.payment ? (
                  <span>
                    تراکنش: {invoice.payment.gateway} / {invoice.payment.refId || 'بدون مرجع'} /{' '}
                    {money(invoice.payment.amount)}
                  </span>
                ) : null}
                {invoice.refund ? (
                  <span>
                    بازپرداخت: {money(invoice.refund.amount)} ({invoice.refund.status})
                  </span>
                ) : null}
                {invoice.status === 'paid' && !invoice.refund ? (
                  <Button size="small" color="warning" onClick={onRefund}>
                    بازپرداخت کامل
                  </Button>
                ) : null}
              </Stack>
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </Fragment>
  );
}
