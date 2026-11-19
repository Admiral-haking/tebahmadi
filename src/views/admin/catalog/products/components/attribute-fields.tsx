import { Fragment } from "react";
import { Grid, MenuItem, Typography } from "@mui/material";

import type { AttributeDef } from "@/catalog/models/ProductType";
import { Field } from "@/components/hook-form";

interface AttributeFieldsProps {
  attributes: AttributeDef[];
  namePrefix: string;
  disabled?: boolean;
}

function requiredLabel(label: string, required?: boolean): string {
  return required ? `${label} *` : label;
}

export default function AttributeFields({ attributes, namePrefix, disabled }: AttributeFieldsProps) {
  if (!attributes.length) {
    return <Typography color="text.secondary">ویژگی فعالی برای این بخش تعریف نشده است.</Typography>;
  }

  return (
    <Grid container spacing={2}>
      {attributes.map((attr) => {
        const name = `${namePrefix}.${attr.key}`;
        const label = requiredLabel(attr.label, attr.required);

        switch (attr.kind) {
          case "text":
            return (
              <Grid key={attr.key} size={{ xs: 12, md: 6 }}>
                <Field.Text name={name} label={label} disabled={disabled} fullWidth required={attr.required} />
              </Grid>
            );
          case "number":
            return (
              <Grid key={attr.key} size={{ xs: 12, md: 6 }}>
                <Field.Text
                  name={name}
                  label={label}
                  type="number"
                  disabled={disabled}
                  fullWidth
                  required={attr.required}
                />
              </Grid>
            );
          case "boolean":
            return (
              <Grid key={attr.key} size={{ xs: 12, md: 6 }}>
                <Field.Switch name={name} label={label} disabled={disabled} />
              </Grid>
            );
          case "enum":
            return (
              <Grid key={attr.key} size={{ xs: 12, md: 6 }}>
                <Field.Select name={name} label={label} disabled={disabled} required={attr.required} fullWidth>
                  <MenuItem value="">انتخاب کنید</MenuItem>
                  {(attr.enumValues ?? []).map((option) => (
                    <MenuItem key={option} value={option}>
                      {option}
                    </MenuItem>
                  ))}
                </Field.Select>
              </Grid>
            );
          case "multi-enum":
            return (
              <Grid key={attr.key} size={{ xs: 12, md: 6 }}>
                <Field.MultiSelect
                  name={name}
                  label={label}
                  options={(attr.enumValues ?? []).map((value) => ({ label: value, value }))}
                  placeholder="انتخاب کنید"
                  checkbox
                  chip
                  disabled={disabled}
                />
              </Grid>
            );
          case "json":
            return (
              <Grid key={attr.key} size={{ xs: 12 }}>
                <Field.Text
                  name={name}
                  label={label}
                  disabled={disabled}
                  fullWidth
                  multiline
                  minRows={4}
                  helperText="مقدار JSON را به صورت قالب معتبر وارد کنید"
                />
              </Grid>
            );
          case "color":
            return (
              <Grid key={attr.key} size={{ xs: 12, md: 6 }}>
                <Field.Select name={name} label={label} disabled={disabled} required={attr.required} fullWidth>
                  <MenuItem value="">انتخاب کنید</MenuItem>
                  {(attr.values ?? []).map((color) => (
                    <MenuItem key={color.key} value={color.key}>
                      {color.name}
                    </MenuItem>
                  ))}
                </Field.Select>
              </Grid>
            );
          default:
            return (
              <Fragment key={attr.key}>
                <Grid size={{ xs: 12 }}>
                  <Typography color="text.secondary">
                    ویژگی {attr.label} پشتیبانی نمی‌شود.
                  </Typography>
                </Grid>
              </Fragment>
            );
        }
      })}
    </Grid>
  );
}
