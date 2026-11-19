import type { CheckboxProps } from "@mui/material/Checkbox";
import type { FormControlLabelProps } from "@mui/material/FormControlLabel";
import type { FormGroupProps } from "@mui/material/FormGroup";
import type { FormHelperTextProps } from "@mui/material/FormHelperText";
import type { FormLabelProps } from "@mui/material/FormLabel";
import type { Theme } from "@mui/material/styles";
import type { SxProps } from "@mui/material/styles";
import { Controller, useFormContext } from "react-hook-form";
import Box from "@mui/material/Box";
import Checkbox from "@mui/material/Checkbox";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormGroup from "@mui/material/FormGroup";
import FormHelperText from "@mui/material/FormHelperText";
import FormLabel from "@mui/material/FormLabel";

type RHFCheckboxProps = Omit<FormControlLabelProps, "control"> & {
  name: string;
  helperText?: React.ReactNode;
  slotProps?: {
    wrapper?: SxProps<Theme>;
    checkbox?: CheckboxProps;
    helperText?: FormHelperTextProps;
  };
};

export function RHFCheckbox({ name, helperText, slotProps, ...labelProps }: RHFCheckboxProps) {
  const { control } = useFormContext();
  const checkboxSlot = slotProps?.checkbox;
  const { onChange: slotOnChange, ...checkboxSlotProps } = checkboxSlot ?? {};

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState: { error } }) => (
        <Box sx={slotProps?.wrapper}>
          <FormControlLabel
            {...labelProps}
            control={
              <Checkbox
                {...checkboxSlotProps}
                checked={!!field.value}
                onChange={(event, checked) => {
                  field.onChange(checked);
                  slotOnChange?.(event, checked);
                }}
              />
            }
          />

          {(!!error || helperText) && (
            <FormHelperText error={!!error} {...slotProps?.helperText}>
              {error?.message ?? helperText}
            </FormHelperText>
          )}
        </Box>
      )}
    />
  );
}

type MultiCheckboxOption = {
  label: string;
  value: string;
};

type RHFMultiCheckboxProps = Omit<FormGroupProps, "defaultValue"> & {
  name: string;
  label?: string;
  helperText?: React.ReactNode;
  options: MultiCheckboxOption[];
  slotProps?: {
    wrapper?: SxProps<Theme>;
    checkbox?: CheckboxProps;
    label?: FormLabelProps;
    helperText?: FormHelperTextProps;
  };
};

export function RHFMultiCheckbox({ name, label, helperText, options, slotProps, ...formGroupProps }: RHFMultiCheckboxProps) {
  const { control } = useFormContext();
  const checkboxSlot = slotProps?.checkbox;
  const { onChange: slotOnChange, ...checkboxSlotProps } = checkboxSlot ?? {};

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState: { error } }) => {
        const value: string[] = Array.isArray(field.value) ? field.value : [];
        const toggle = (optionValue: string) => {
          if (value.includes(optionValue)) {
            field.onChange(value.filter((item) => item !== optionValue));
          } else {
            field.onChange([...value, optionValue]);
          }
        };

        return (
          <FormControl component="fieldset" sx={slotProps?.wrapper} error={!!error}>
            {label && (
              <FormLabel {...slotProps?.label} sx={{ mb: 1, ...slotProps?.label?.sx }}>
                {label}
              </FormLabel>
            )}

            <FormGroup {...formGroupProps}>
              {options.map((option) => (
                <FormControlLabel
                  key={option.value}
                  label={option.label}
                  control={
                    <Checkbox
                      {...checkboxSlotProps}
                      checked={value.includes(option.value)}
                      onChange={(event, checked) => {
                        toggle(option.value);
                        slotOnChange?.(event, checked);
                      }}
                    />
                  }
                />
              ))}
            </FormGroup>

            {(!!error || helperText) && (
              <FormHelperText {...slotProps?.helperText} error={!!error}>
                {error?.message ?? helperText}
              </FormHelperText>
            )}
          </FormControl>
        );
      }}
    />
  );
}
