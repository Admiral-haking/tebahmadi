'use client';

import {
  BuildRounded,
  CampaignRounded,
  ShoppingBagRounded,
  PsychologyRounded,
} from '@mui/icons-material';
import { Chip, MenuItem, Paper, Stack, Typography, Grid } from '@mui/material';
import { useMemo } from 'react';
import { RHFTextField, RHFSwitch, RHFSelect } from '@/components/hook-form';
import { CONFIG_SECTIONS, type ConfigFieldDefinition } from '../config-field-presets';
import type { EnvVariableSummary } from '../../hooks';

interface EssentialConfigFieldsetProps {
  disabled?: boolean;
  envLookup?: Record<string, EnvVariableSummary | undefined>;
}

const sectionIconMap: Record<string, React.ElementType> = {
  notifications: CampaignRounded,
  ops: BuildRounded,
  ai: PsychologyRounded,
};

const sectionAccentMap: Record<string, string> = {
  notifications: 'success',
  ops: 'warning',
  ai: 'info',
};

function buildHelperText(field: ConfigFieldDefinition, env?: EnvVariableSummary) {
  if (!field.envKey) {
    return field.helperText;
  }
  if (!env) {
    return field.helperText;
  }
  const statusLabel = env.present ? 'تنظیم شده در .env' : 'هنوز در .env خالی است';
  return (
    <Stack spacing={0.5}>
      {field.helperText ? <span>{field.helperText}</span> : null}
      <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
        <Chip
          size="small"
          color={env.present ? 'success' : 'warning'}
          label={`ENV: ${env.key}`}
        />
        <Typography variant="caption" color="text.secondary">
          {statusLabel}
        </Typography>
      </Stack>
    </Stack>
  );
}

function FieldRenderer({
  field,
  disabled,
  env,
}: {
  field: ConfigFieldDefinition;
  disabled?: boolean;
  env?: EnvVariableSummary;
}) {
  const helperText = buildHelperText(field, env);
  if (field.type === 'switch') {
    return (
      <Paper variant="outlined" sx={{ p: 2, bgcolor: "rgba(var(--mui-palette-warning-lightChannel) / 0.08)" }}>
        <RHFSwitch
          name={`configFields.${field.key}`}
          label={field.label}
          helperText={helperText}
          disabled={disabled}
        />
      </Paper>
    );
  }

  if (field.type === 'select') {
    return (
      <RHFSelect name={`configFields.${field.key}`} label={field.label} helperText={helperText} disabled={disabled}>
        {(field.options ?? []).map((opt) => (
          <MenuItem key={opt.value} value={opt.value}>
            {opt.label}
          </MenuItem>
        ))}
      </RHFSelect>
    );
  }

  const inputType =
    field.type === 'tel' ? 'tel' : field.type === 'url' ? 'url' : 'text';

  return (
    <RHFTextField
      name={`configFields.${field.key}`}
      label={field.label}
      placeholder={field.placeholder}
      helperText={helperText}
      disabled={disabled}
      multiline={field.type === 'textarea'}
      minRows={field.rows ?? (field.type === 'textarea' ? 3 : undefined)}
      type={inputType}
      inputProps={inputType === 'tel' || inputType === 'url' ? { dir: 'ltr' } : undefined}
    />
  );
}

export default function EssentialConfigFieldset({ disabled, envLookup }: EssentialConfigFieldsetProps) {
  const lookup = useMemo(
    () => envLookup ?? {},
    [envLookup],
  );

  return (
    <Stack spacing={3}>
      {CONFIG_SECTIONS.map((section) => {
        const Icon = sectionIconMap[section.id] ?? ShoppingBagRounded;
        const accent = sectionAccentMap[section.id] ?? 'primary';

        return (
          <Paper key={section.id} variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
            <Stack spacing={1.5} mb={2}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Icon color={accent as any} />
                <Typography variant="h6" fontWeight={600}>
                  {section.title}
                </Typography>
              </Stack>
              <Typography variant="body2" color="text.secondary">
                {section.subtitle}
              </Typography>
            </Stack>
            <Grid container spacing={2}>
              {section.fields.map((field) => (
                <Grid key={field.key} size={{ xs: 12, md: field.type === 'textarea' ? 12 : 6 }}>
                  <FieldRenderer field={field} disabled={disabled} env={field.envKey ? lookup[field.envKey] : undefined} />
                </Grid>
              ))}
            </Grid>
          </Paper>
        );
      })}
    </Stack>
  );
}
