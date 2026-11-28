'use client';

import Link from 'next/link';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';

import { formatToman } from '../constants';
import { FilterText } from '@/utils/text';
import MarketplacePresence, { type LinePresence } from './MarketplacePresence';

export interface InvoiceLineView {
  id: string;
  productId: string;
  productSlug?: string;
  variantId?: string;
  title: string;
  sku: string;
  variantSummary?: string;
  quantity?: number;
  requestedQty?: number;
  requestedUnit?: string;
  unitPriceBase: number;
  unitPriceEffective: number;
  lineTotal: number;
  offerAmount?: number;
  priceModel: 'fixed' | 'per_unit';
  unitOfMeasure?: string;
  mediaId?: string;
  weightGrams?: number;
}

interface InvoiceLinesTableProps {
  lines: InvoiceLineView[];
  /** marketplace presence keyed by site variant id. */
  presence?: Record<string, LinePresence>;
}

const FALLBACK_IMAGE =
  'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2280%22 height=%2280%22 viewBox=%220 0 96 96%22%3E%3Crect width=%2296%22 height=%2296%22 rx=%2212%22 fill=%22%23f0f0f0%22/%3E%3Cpath d=%22M24 68h48a4 4 0 0 0 3.2-6.4l-16-21.333a4 4 0 0 0-6.4 0L36 60l-6.4-8.533a4 4 0 0 0-6.4 0L20 62a4 4 0 0 0 4 6Z%22 fill=%22%23d0d0d0%22/%3E%3Ccircle cx=%2236%22 cy=%2230%22 r=%228%22 fill=%22%23d0d0d0%22/%3E%3C/svg%3E';

function renderQuantity(line: InvoiceLineView): string {
  if (line.priceModel === 'per_unit' && line.requestedQty) {
    const unit = line.requestedUnit ?? line.unitOfMeasure ?? '';
    return `${line.requestedQty.toLocaleString('fa-IR')} ${unit}`;
  }
  if (line.quantity) {
    return `${line.quantity.toLocaleString('fa-IR')} عدد`;
  }
  return '—';
}

export default function InvoiceLinesTable({ lines, presence }: InvoiceLinesTableProps) {
  return (
    <Card variant="outlined" sx={{ borderRadius: 4 }}>
      <CardContent sx={{ p: 0 }}>
        <TableContainer>
          <Table size='small' sx={{ minWidth: 700 }} >
            <TableHead>
              <TableRow sx={{ '& th': { bgcolor: 'rgba(var(--mui-palette-text-secondaryChannel) / 0.08)', fontWeight: 700 } }}>
                <TableCell width={300}>محصول</TableCell>
                <TableCell>شناسه</TableCell>
                <TableCell>پنل‌ها</TableCell>
                <TableCell align="center">تعداد</TableCell>
                <TableCell align="right">قیمت واحد</TableCell>
                <TableCell align="right">تخفیف</TableCell>
                <TableCell align="right">مبلغ نهایی</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {lines.map((line) => (
                <TableRow key={line.id} hover sx={{ '&:last-of-type td': { borderBottom: 0 } }}>
                  <TableCell>
                    <Stack direction="row" spacing={1.5} alignItems="flex-start">
                      <Box
                        component="img"
                        src={line.mediaId ? `/api/media/${line.mediaId}` : FALLBACK_IMAGE}
                        alt={line.title}
                        sx={{
                          width: 72,
                          height: 72,
                          borderRadius: 2,
                          objectFit: 'cover',
                          border: '1px solid',
                          borderColor: 'divider',
                          flexShrink: 0,
                        }}
                      />
                      <Stack spacing={0.5} minWidth={0}>
                        {line.productSlug ? (
                          <Typography
                            variant="body2"
                            component={Link}
                            href={
                              line.variantId
                                ? `/product/${line.productSlug}?variantId=${line.variantId}`
                                : `/product/${line.productSlug}`
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            sx={{ fontWeight: 700, textDecoration: 'none', color: 'text.primary' }}
                          >
                            {line.title}
                          </Typography>
                        ) : (
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>
                            {line.title}
                          </Typography>
                        )}

                        {line.variantSummary ? (
                          <Typography variant="caption" color="text.secondary">
                            {line.variantSummary.replace(/\/ weightGrams: [0-9]+/g, "")}
                          </Typography>
                        ) : null}
                        <Typography variant='caption'>
                          {line.priceModel === 'per_unit' ? 'بر اساس واحد' : 'قیمت ثابت'}
                        </Typography>
                      </Stack>
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Stack spacing={0.25} alignItems="flex-start">
                      <Tooltip disableFocusListener title={`بارکد: ${line.sku}`}>
                        <Button sx={{ minWidth: 0 }}>
                          {FilterText(line.sku)}
                        </Button>
                      </Tooltip>
                      {line.variantId ? (
                        <Typography variant="caption" color="text.secondary" sx={{ direction: 'ltr', px: 1 }}>
                          واریانت: {line.variantId.slice(-8)}
                        </Typography>
                      ) : null}
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <MarketplacePresence presence={line.variantId ? presence?.[line.variantId] : undefined} />
                  </TableCell>
                  <TableCell align="center">
                    <Typography variant="body2">{renderQuantity(line)}</Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" color="text.secondary">
                      {formatToman(line.unitPriceBase)}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" color={line.offerAmount ? 'error.main' : 'text.secondary'}>
                      {line.offerAmount ? `-${formatToman(line.offerAmount)}` : '—'}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                      {formatToman(line.lineTotal)}
                    </Typography>
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
