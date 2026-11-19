import type { ChipProps } from "@mui/material/Chip";
import type { CheckboxProps } from "@mui/material/Checkbox";
import type { FormControlProps } from "@mui/material/FormControl";
import type { FormHelperTextProps } from "@mui/material/FormHelperText";
import type { InputLabelProps } from "@mui/material/InputLabel";
import type { SelectProps, SelectChangeEvent } from "@mui/material/Select";
import type { TextFieldProps } from "@mui/material/TextField";
import type { Theme } from "@mui/material/styles";
import type { SxProps } from "@mui/material/styles";
import { Controller, useFormContext } from "react-hook-form";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Checkbox from "@mui/material/Checkbox";
import FormControl from "@mui/material/FormControl";
import FormHelperText from "@mui/material/FormHelperText";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import TextField from "@mui/material/TextField";

type RHFSelectProps = Omit<TextFieldProps, "name" | "value" | "defaultValue" | "onChange"> & {
  name: string;
  native?: boolean;
  children: React.ReactNode;
  menuPaperSx?: SxProps<Theme>;
};

export function RHFSelect({ name, native, children, helperText, InputLabelProps, inputProps, menuPaperSx, ...textFieldProps }: RHFSelectProps) {
  const { control } = useFormContext();
  const labelId = `${name}-select-label`;

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState: { error } }) => {
        const { ref, value, onChange, ...restField } = field;
        return (
          <TextField
            {...textFieldProps}
            {...restField}
            inputRef={ref}
            value={value ?? ""}
            select
            fullWidth
            SelectProps={{
              native,
              MenuProps: { PaperProps: { sx: menuPaperSx } },
              ...textFieldProps.SelectProps,
            }}
            InputLabelProps={{ htmlFor: labelId, ...InputLabelProps }}
            inputProps={{ id: labelId, ...inputProps }}
            error={!!error}
            helperText={error?.message ?? helperText}
            onChange={onChange}
          >
            {children}
          </TextField>
        );
      }}
    />
  );
}

type RHFMultiSelectOption = {
  label: string;
  value: string;
};

type RHFMultiSelectProps = Omit<FormControlProps, "defaultValue"> & {
  name: string;
  label?: string;
  helperText?: React.ReactNode;
  placeholder?: string;
  options: RHFMultiSelectOption[];
  chip?: boolean;
  checkbox?: boolean;
  slotProps?: {
    chip?: ChipProps;
    select?: SelectProps;
    checkbox?: CheckboxProps;
    inputLabel?: InputLabelProps;
    formHelperText?: FormHelperTextProps;
  };
};

export function RHFMultiSelect({ name, label, helperText, placeholder, options, chip, checkbox, slotProps, ...formControlProps }: RHFMultiSelectProps) {
  const { control } = useFormContext();
  const labelId = `${name}-multi-select-label`;

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState: { error } }) => {
        const value: string[] = Array.isArray(field.value) ? field.value : [];
        const handleChange = (event: SelectChangeEvent<string[]>) => {
          const next = event.target.value;
          field.onChange(typeof next === "string" ? next.split(",") : next);
        };

        return (
          <FormControl {...formControlProps} error={!!error}>
            {label && (
              <InputLabel htmlFor={labelId} {...slotProps?.inputLabel}>
                {label}
              </InputLabel>
            )}

            <Select
              {...field}
              {...slotProps?.select}
              value={value}
              multiple
              displayEmpty={!!placeholder}
              labelId={labelId}
              label={label}
              onChange={(event) => handleChange(event as SelectChangeEvent<string[]>)}
              renderValue={(selected) => {
                const items = options.filter((opt) => (selected as string[]).includes(opt.value));
                if (items.length === 0 && placeholder) {
                  return <Box sx={{ color: "text.disabled" }}>{placeholder}</Box>;
                }
                if (chip) {
                  return (
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                      {items.map((item) => (
                        <Chip key={item.value} size="small" label={item.label} {...slotProps?.chip} />
                      ))}
                    </Box>
                  );
                }
                return items.map((item) => item.label).join(", ");
              }}
              inputProps={{ id: labelId, ...slotProps?.select?.inputProps }}
            >
              {options.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {checkbox && (
                    <Checkbox
                      size="small"
                      disableRipple
                      checked={value.includes(option.value)}
                      {...slotProps?.checkbox}
                    />
                  )}
                  {option.label}
                </MenuItem>
              ))}
            </Select>

            {(!!error || helperText) && (
              <FormHelperText {...slotProps?.formHelperText} error={!!error}>
                {error?.message ?? helperText}
              </FormHelperText>
            )}
          </FormControl>
        );
      }}
    />
  );
}
