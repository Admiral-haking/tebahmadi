"use client";

import { Controller, useFormContext } from "react-hook-form";
import { Editor, type EditorProps } from "@/components/editor";

type Props = Omit<EditorProps, "value" | "onChange" | "onBlur"> & {
  name: string;
};

export function RHFEditor({ name, helperText, ...editorProps }: Props) {
  const { control } = useFormContext();

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState: { error } }) => (
        <Editor
          {...editorProps}
          value={field.value}
          onChange={field.onChange}
          onBlur={field.onBlur}
          error={!!error}
          helperText={error?.message ?? helperText}
        />
      )}
    />
  );
}
