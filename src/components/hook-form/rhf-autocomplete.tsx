import type { AutocompleteChangeDetails, AutocompleteChangeReason, AutocompleteProps } from "@mui/material/Autocomplete";
import Autocomplete from "@mui/material/Autocomplete";
import type { TextFieldProps } from "@mui/material/TextField";
import TextField from "@mui/material/TextField";
import { Controller, useFormContext } from "react-hook-form";

type RHFAutocompleteProps<T, Multiple extends boolean | undefined, DisableClearable extends boolean | undefined, FreeSolo extends boolean | undefined> = Omit<
  AutocompleteProps<T, Multiple, DisableClearable, FreeSolo>,
  "renderInput"
> & {
  name: string;
  helperText?: React.ReactNode;
  label?: string;
  placeholder?: string;
  textFieldProps?: TextFieldProps;
};

export function RHFAutocomplete<T, Multiple extends boolean | undefined = undefined, DisableClearable extends boolean | undefined = undefined, FreeSolo extends boolean | undefined = undefined>({
  name,
  helperText,
  label,
  placeholder,
  textFieldProps,
  onChange,
  ...autoCompleteProps
}: RHFAutocompleteProps<T, Multiple, DisableClearable, FreeSolo>) {
  const { control, setValue } = useFormContext();

  const isMultiple = Boolean(autoCompleteProps.multiple);

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState: { error } }) => {
        const resolvedValue = field.value ?? (isMultiple ? [] : null);

        return (
          <Autocomplete
            {...autoCompleteProps}
            value={resolvedValue}
            onChange={(event, newValue, reason, details) => {
              setValue(name, newValue as never, { shouldValidate: true, shouldDirty: true });
              onChange?.(event, newValue, reason as AutocompleteChangeReason, details as AutocompleteChangeDetails<T>);
            }}
            onBlur={field.onBlur}
            renderInput={(params) => (
              <TextField
                {...params}
                {...textFieldProps}
                label={label}
                placeholder={placeholder}
                error={!!error}
                helperText={error?.message ?? helperText}
                inputProps={{ ...params.inputProps, autoComplete: "new-password" }}
                inputRef={(element) => {
                  field.ref(element);
                }}
              />
            )}
          />
        );
      }}
    />
  );
}
