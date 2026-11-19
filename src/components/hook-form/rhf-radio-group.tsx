import type { FormControlProps } from "@mui/material/FormControl";
import type { FormHelperTextProps } from "@mui/material/FormHelperText";
import type { FormLabelProps } from "@mui/material/FormLabel";
import type { RadioGroupProps } from "@mui/material/RadioGroup";
import type { RadioProps } from "@mui/material/Radio";
import { Controller, useFormContext } from "react-hook-form";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormHelperText from "@mui/material/FormHelperText";
import FormLabel from "@mui/material/FormLabel";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";

type Option = {
  label: string;
  value: string;
};

type RHFRadioGroupProps = Omit<RadioGroupProps, "defaultValue"> & {
  name: string;
  options: Option[];
  label?: string;
  helperText?: React.ReactNode;
  formControlProps?: FormControlProps;
  slotProps?: {
    radio?: RadioProps;
    formLabel?: FormLabelProps;
    helperText?: FormHelperTextProps;
  };
};

export function RHFRadioGroup({ name, options, label, helperText, formControlProps, slotProps, ...radioGroupProps }: RHFRadioGroupProps) {
  const { control } = useFormContext();

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState: { error } }) => (
        <FormControl {...formControlProps} error={!!error}>
          {label && (
            <FormLabel {...slotProps?.formLabel} sx={{ mb: 1, ...slotProps?.formLabel?.sx }}>
              {label}
            </FormLabel>
          )}

          <RadioGroup
            {...field}
            {...radioGroupProps}
            value={field.value ?? ""}
            onChange={(event, newValue) => {
              field.onChange(newValue);
              radioGroupProps.onChange?.(event, newValue);
            }}
          >
            {options.map((option) => (
              <FormControlLabel
                key={option.value}
                value={option.value}
                label={option.label}
                control={<Radio {...slotProps?.radio} />}
              />
            ))}
          </RadioGroup>

          {(!!error || helperText) && (
            <FormHelperText error={!!error} {...slotProps?.helperText}>
              {error?.message ?? helperText}
            </FormHelperText>
          )}
        </FormControl>
      )}
    />
  );
}
