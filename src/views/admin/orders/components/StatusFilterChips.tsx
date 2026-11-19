'use client';

import Link from 'next/link';
import { Chip, Stack } from '@mui/material';

import { STATUS_COLORS, STATUS_FILTERS, STATUS_LABELS, type InvoiceStatus } from '../constants';

interface StatusFilterChipsProps {
  currentStatus: 'all' | InvoiceStatus;
  query?: string;
}

function buildHref(status: 'all' | InvoiceStatus, query?: string) {
  const params = new URLSearchParams();
  if (query) {
    params.set('q', query);
  }
  if (status !== 'all') {
    params.set('status', status);
  }
  params.set('page', '1');
  const queryString = params.toString();
  return queryString ? `/admin/orders?${queryString}` : '/admin/orders';
}

export default function StatusFilterChips({ currentStatus, query }: StatusFilterChipsProps) {
  return (
    <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
      {STATUS_FILTERS.map((option) => {
        if (option.value === 'all') {
          return (
            <Chip
              key={option.value}
              label={option.label}
              component={Link}
              href={buildHref(option.value, query)}
              clickable
              color={currentStatus === 'all' ? 'primary' : 'default'}
              variant={currentStatus === 'all' ? 'filled' : 'outlined'}
            />
          );
        }

        const { bg, color, border } = STATUS_COLORS[option.value];
        const active = currentStatus === option.value;

        return (
          <Chip
            key={option.value}
            label={STATUS_LABELS[option.value]}
            component={Link}
            href={buildHref(option.value, query)}
            clickable
            sx={{
              bgcolor: active ? color : bg,
              color: active ? '#fff' : color,
              border: '1px solid',
              borderColor: active ? color : border,
              fontWeight: active ? 700 : 500,
            }}
          />
        );
      })}
    </Stack>
  );
}
