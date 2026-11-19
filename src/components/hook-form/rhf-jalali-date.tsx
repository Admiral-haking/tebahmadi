"use client";

import { Controller, useFormContext } from "react-hook-form";
import JalaliDateField from "../jalali-date-field";
import type { TextFieldProps } from "@mui/material";

type Props = Omit<TextFieldProps, "name"> & {
  name: string;
  withTime?: boolean;
};

/**
 * RHF-bound Jalali date/time field. Drop-in replacement for
 * `<Field.Text type="datetime-local" />`: the form value stays the Gregorian
 * string the schema expects, but the user enters/sees a Shamsi date.
 */
export function RHFJalaliDate({ name, withTime, helperText, ...rest }: Props) {
  const { control } = useFormContext();
  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState: { error } }) => (
        <JalaliDateField
          {...rest}
          withTime={withTime}
          value={field.value ?? ""}
          onChange={(v) => field.onChange(v)}
          error={!!error}
          helperText={error?.message ?? helperText}
        />
      )}
    />
  );
}
