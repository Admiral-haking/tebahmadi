'use client';

import { Chip } from '@mui/material';

import { STATUS_COLORS, STATUS_LABELS, type InvoiceStatus } from '../constants';

interface StatusChipProps {
  status: InvoiceStatus;
  size?: 'small' | 'medium';
}

export default function StatusChip({ status, size = 'small' }: StatusChipProps) {
  const { bg, color, border } = STATUS_COLORS[status];
  return (
    <Chip
      label={STATUS_LABELS[status]}
      size={size}
      sx={{
        bgcolor: bg,
        color,
        border: '1px solid',
        borderColor: border,
        fontWeight: 600,
      }}
    />
  );
}
