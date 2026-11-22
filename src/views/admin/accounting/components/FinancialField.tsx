'use client';

import type { Dispatch, SetStateAction } from 'react';
import { TextField } from '@mui/material';

type Props = {
  form: Record<string, string>;
  setForm: Dispatch<SetStateAction<Record<string, string>>>;
  name: string;
  label: string;
  type?: string;
};

export default function FinancialField({ form, setForm, name, label, type = 'text' }: Props) {
  return (
    <TextField
      size="small"
      type={type}
      label={label}
      value={form[name] ?? ''}
      onChange={(event) => setForm((current) => ({ ...current, [name]: event.target.value }))}
      slotProps={type === 'date' ? { inputLabel: { shrink: true } } : undefined}
    />
  );
}
