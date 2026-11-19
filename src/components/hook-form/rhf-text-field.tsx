import type { TextFieldProps } from "@mui/material/TextField";
import TextField from "@mui/material/TextField";
import { Controller, useFormContext } from "react-hook-form";

type Props = Omit<TextFieldProps, "name" | "value" | "defaultValue"> & {
  name: string;
  parse?: (value: string) => unknown;
};

export function RHFTextField({ name, helperText, type, parse, onChange: externalChange, ...textFieldProps }: Props) {
  const { control } = useFormContext();

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState: { error } }) => {
        const { ref, value, onChange, ...restField } = field;

        const displayValue = type === "number"
          ? value === undefined || value === null
            ? ""
            : value
          : value ?? "";

        const handleChange: NonNullable<TextFieldProps["onChange"]> = (event) => {
          const { value: raw } = event.target;
          let next: unknown = raw;

          if (type === "number") {
            next = raw === "" ? undefined : Number(raw);
          }

          if (parse) {
            next = parse(raw);
          }

          onChange(next);

          if (externalChange) {
            externalChange(event);
          }
        };

        return (
          <TextField
            fullWidth
            {...textFieldProps}
            {...restField}
            inputRef={ref}
            value={displayValue}
            type={type}
            error={!!error}
            helperText={error?.message ?? helperText}
            onChange={handleChange}
          />
        );
      }}
    />
  );
}
