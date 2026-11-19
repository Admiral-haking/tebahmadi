'use client';

import {
  AddRounded,
  ArrowDownwardRounded,
  ArrowUpwardRounded,
  AutoAwesomeRounded,
  DeleteOutlineRounded,
  InfoOutlined,
  LocalShippingRounded,
  LoginRounded,
  ReceiptLongRounded,
  ShoppingBagRounded,
} from '@mui/icons-material';
import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  Divider,
  IconButton,
  Link,
  Paper,
  Stack,
  Tooltip,
  Typography,
  Grid
} from '@mui/material';
import { useFieldArray, useFormContext, useWatch } from 'react-hook-form';
import { RHFAutocomplete, RHFTextField } from '@/components/hook-form';
import type { SiteConfigFormValues, SmsTemplateVariableFormValue } from '../site-config-form';
import type { SmsTemplatePreset } from '../sms-template-presets';
import { SMS_TEMPLATE_PRESETS } from '../sms-template-presets';

interface SmsTemplatesFieldProps {
  disabled?: boolean;
}

const SMS_IR_DOC_URL = 'https://www.sms.ir';


const TEMPLATE_ICON_MAP: any = {
  loginCode: LoginRounded,
  orderConfirmation: ShoppingBagRounded,
  paymentReceipt: ReceiptLongRounded,
  shipmentTracking: LocalShippingRounded,
};

export default function SmsTemplatesField({ disabled }: SmsTemplatesFieldProps) {
  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ xs: 'flex-start', sm: 'center' }} justifyContent="space-between">
        <Box>
          <Typography variant="h6" fontWeight={600}>
            قالب‌های پیامک SMS.ir
          </Typography>
          <Typography variant="body2" color="text.secondary">
            قالب‌های تأییدشدهٔ SMS.ir را برای سناریوهای پیامکی تنظیم کنید. ورود با قالب Verify و پارامتر CODE ارسال می‌شود.
          </Typography>
        </Box>
        <Button
          component={Link}
          href={SMS_IR_DOC_URL}
          target="_blank"
          rel="noopener noreferrer"
          variant="outlined"
          size="small"
          sx={{ whiteSpace: 'nowrap' }}
        >
          راهنمای SMS.ir
        </Button>
      </Stack>

      <Grid container spacing={2}>
        {SMS_TEMPLATE_PRESETS.map((preset) => (
          <Grid key={preset.kind} size={{ xs: 12, md: 6 }}>
            <TemplateCard preset={preset} disabled={disabled} />
          </Grid>
        ))}
      </Grid>
    </Stack>
  );
}

interface TemplateCardProps {
  preset: SmsTemplatePreset;
  disabled?: boolean;
}

function TemplateCard({ preset, disabled }: TemplateCardProps) {
  const { control, setValue } = useFormContext<SiteConfigFormValues>();
  const namePrefix = `smsTemplates.${preset.kind}` as const;
  const variablesName = `${namePrefix}.variables` as const;
  const templateField = `${namePrefix}.template` as const;
  const Icon = TEMPLATE_ICON_MAP[preset.kind] ?? InfoOutlined;

  const templateValue = useWatch({
    control,
    name: templateField,
  }) as string | undefined;

  const currentVariables = useWatch({
    control,
    name: variablesName,
  }) as SmsTemplateVariableFormValue[] | undefined;

  const { fields, append, remove, move } = useFieldArray({
    control,
    name: variablesName,
  });

  const isActive = Boolean(templateValue?.trim());

  const availableOptions = preset.fields.map((field) => field.key);

  const handleInsertValue = (value?: string) => {
    if (typeof value === 'string') {
      const emptyIndex = (currentVariables ?? []).findIndex((item) => !(item?.value ?? '').trim());
      if (emptyIndex >= 0) {
        setValue(`${variablesName}.${emptyIndex}.value`, value, { shouldDirty: true, shouldTouch: true });
        return;
      }
    }
    append({ value: value ?? '' }, { shouldFocus: true });
  };

  const handleApplyRecommended = () => {
    if (!preset.recommendedOrder?.length) {
      return;
    }
    setValue(
      variablesName,
      preset.recommendedOrder.map((value) => ({ value })),
      { shouldDirty: true, shouldTouch: true },
    );
  };

  const previewPairs = (currentVariables ?? []).map((item, index) => ({
    key: `param${index + 1}`,
    value: item?.value?.trim() || '—',
  }));

  return (
    <Card
      variant="outlined"
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderColor: isActive ? 'success.light' : undefined,
      }}
    >
      <CardHeader
        avatar={
          <Avatar
            sx={{
              bgcolor: isActive ? 'success.light' : 'primary.light',
              color: isActive ? 'success.dark' : 'primary.dark',
            }}
          >
            <Icon fontSize="small" />
          </Avatar>
        }
        title={
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="subtitle1" fontWeight={600}>
              {preset.title}
            </Typography>
            {preset.comingSoon ? (
              <Chip label="به‌زودی" size="small" color="warning" variant="outlined" />
            ) : null}
          </Stack>
        }
        subheader={
          <Typography variant="body2" color="text.secondary">
            {preset.summary}
          </Typography>
        }
        action={
          <Stack direction="column" alignItems="flex-end" spacing={1}>
            <Chip
              label={isActive ? 'فعال' : 'غیرفعال'}
              size="small"
              color={isActive ? 'success' : 'default'}
              variant={isActive ? 'filled' : 'outlined'}
            />
            {preset.docAnchor ? (
              <Link
                href={SMS_IR_DOC_URL}
                target="_blank"
                rel="noopener noreferrer"
                variant="body2"
              >
                مستندات
              </Link>
            ) : null}
          </Stack>
        }
      />
      <Divider />
      <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, flexGrow: 1 }}>
        {preset.helperText ? (
          <Paper variant="outlined" sx={{ p: 1.5, bgcolor: "rgba(var(--mui-palette-primary-lightChannel) / 0.08)" }}>
            <Stack direction="row" spacing={1} alignItems="flex-start">
              <InfoOutlined sx={{ color: 'text.secondary', fontSize: 18, mt: '2px' }} />
              <Typography variant="body2" color="text.secondary">
                {preset.helperText}
              </Typography>
            </Stack>
          </Paper>
        ) : null}

        <Stack spacing={1}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography variant="subtitle2" fontWeight={600}>
              داده‌های قابل استفاده
            </Typography>
            <Typography variant="caption" color="text.secondary">
              روی هر مورد کلیک کنید تا به انتهای لیست پارامترها اضافه شود.
            </Typography>
          </Stack>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {preset.fields.map((field) => (
              <Tooltip
                key={field.key}
                title={
                  <Box>
                    <Typography variant="body2" fontWeight={600}>
                      {field.label}
                    </Typography>
                    {field.description ? (
                      <Typography variant="caption" display="block">
                        {field.description}
                      </Typography>
                    ) : null}
                    {field.sample ? (
                      <Typography variant="caption" color="text.secondary">
                        مثال: {field.sample}
                      </Typography>
                    ) : null}
                  </Box>
                }
              >
                <Chip
                  label={field.label}
                  size="small"
                  color={field.optional ? 'default' : 'primary'}
                  variant={field.optional ? 'outlined' : 'filled'}
                  onClick={() => handleInsertValue(field.key)}
                  clickable
                  disabled={disabled}
                />
              </Tooltip>
            ))}
          </Stack>
        </Stack>

        <RHFTextField
          name={templateField}
          label="تنظیم قالب در SMS.ir"
          placeholder="شناسه قالب OTP از environment خوانده می‌شود"
          helperText="برای ورود، شناسهٔ عددی قالب در SMS_IR_OTP_TEMPLATE_ID و نام پارامتر در SMS_IR_TEMPLATE_PARAMETER تنظیم می‌شود."
          disabled={disabled}
          inputProps={{ dir: 'ltr' }}
        />

        <Stack spacing={1} direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'stretch', sm: 'center' }} justifyContent="space-between">
          <Typography variant="subtitle2" fontWeight={600}>
            ترتیب پارامترها (param1, param2, ...)
          </Typography>
          <Button
            size="small"
            variant="text"
            startIcon={<AutoAwesomeRounded />}
            onClick={handleApplyRecommended}
            disabled={disabled || !preset.recommendedOrder?.length}
          >
            اعمال ترتیب پیشنهادی
          </Button>
        </Stack>

        <Stack spacing={1.5}>
          {fields.length === 0 ? (
            <Paper variant="outlined" sx={{ p: 2, textAlign: 'center', color: 'text.secondary' }}>
              <Typography variant="body2" gutterBottom>
                هنوز پارامتری چیده نشده است.
              </Typography>
              <Button
                size="small"
                variant="outlined"
                startIcon={<AddRounded />}
                onClick={() => handleInsertValue(preset.recommendedOrder?.[0] ?? preset.fields[0]?.key ?? '')}
                disabled={disabled}
              >
                افزودن اولین پارامتر
              </Button>
            </Paper>
          ) : (
            fields.map((field, index) => {
              const fieldName = `${variablesName}.${index}.value` as const;
              return (
                <Paper key={field.id} variant="outlined" sx={{ p: 1.5 }}>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ xs: 'flex-start', sm: 'center' }}>
                    <Chip label={`param${index + 1}`} color="secondary" variant="outlined" />
                    <Box flexGrow={1} width="100%">
                      <RHFAutocomplete<string, false, false, true>
                        freeSolo
                        name={fieldName}
                        options={availableOptions}
                        disableClearable={false}
                        textFieldProps={{
                          label: 'نام داده',
                          placeholder: 'مثال: total',
                          InputLabelProps: { shrink: true },
                          inputProps: { dir: 'ltr' },
                        }}
                        disabled={disabled}
                      />
                    </Box>
                    <Stack direction="row" spacing={0.5}>
                      <Tooltip title="انتقال به بالا">
                        <span>
                          <IconButton
                            size="small"
                            onClick={() => move(index, index - 1)}
                            disabled={disabled || index === 0}
                          >
                            <ArrowUpwardRounded fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title="انتقال به پایین">
                        <span>
                          <IconButton
                            size="small"
                            onClick={() => move(index, index + 1)}
                            disabled={disabled || index === fields.length - 1}
                          >
                            <ArrowDownwardRounded fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title="حذف پارامتر">
                        <span>
                          <IconButton size="small" onClick={() => remove(index)} disabled={disabled}>
                            <DeleteOutlineRounded fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </Stack>
                  </Stack>
                </Paper>
              );
            })
          )}
        </Stack>

        <Box>
          <Button
            startIcon={<AddRounded />}
            variant="outlined"
            size="small"
            onClick={() => handleInsertValue()}
            disabled={disabled}
          >
            افزودن پارامتر جدید
          </Button>
        </Box>

        <Stack spacing={1}>
          <Typography variant="caption" color="text.secondary">
            پیش‌نمایش مقداردهی:
          </Typography>
          <Paper variant="outlined" sx={{ p: 1.5 }}>
            {previewPairs.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                paramها پس از افزودن نمایش داده می‌شوند.
              </Typography>
            ) : (
              <Stack spacing={1}>
                {previewPairs.map((pair) => (
                  <Stack key={pair.key} direction="row" spacing={1} alignItems="center">
                    <Chip label={pair.key} size="small" />
                    <Typography variant="body2" sx={{ direction: 'ltr' }}>
                      {pair.value}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            )}
          </Paper>
        </Stack>
      </CardContent>
    </Card>
  );
}
