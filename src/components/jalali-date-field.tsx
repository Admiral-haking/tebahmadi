"use client";

import { useEffect, useState } from "react";
import { TextField, type TextFieldProps } from "@mui/material";
import { isoToJalaliInput, parseJalaliInput } from "@/lib/jalali";

type Props = Omit<TextFieldProps, "value" | "onChange"> & {
  /** Stored value: ISO or "YYYY-MM-DD[THH:mm]". */
  value?: string | null;
  /** Called with the same (Gregorian) string format on a valid commit. */
  onChange?: (value: string) => void;
  /** Include a time part (HH:mm). */
  withTime?: boolean;
};

/**
 * RTL Jalali (Shamsi) date/time input. The user types/sees a Persian-digit
 * Jalali date (۱۴۰۳/۰۵/۲۱[ ۱۴:۳۰]); the value committed to the form stays
 * Gregorian ("YYYY-MM-DD" or "YYYY-MM-DDTHH:mm"), so storage/back-end logic is
 * unchanged. Invalid input shows an error and is not committed.
 */
export default function JalaliDateField({ value, onChange, withTime = false, helperText, ...rest }: Props) {
  const [text, setText] = useState(() => isoToJalaliInput(value, withTime));
  const [error, setError] = useState(false);

  // Re-sync when the stored value changes from outside.
  useEffect(() => { setText(isoToJalaliInput(value, withTime)); setError(false); }, [value, withTime]);

  function commit() {
    const parsed = parseJalaliInput(text, withTime);
    if (parsed === null) { setError(true); return; }
    setError(false);
    onChange?.(parsed);
  }

  return (
    <TextField
      {...rest}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commit(); } }}
      error={error || rest.error}
      helperText={error ? "تاریخ شمسی نامعتبر است (مثال: ۱۴۰۳/۰۵/۲۱)" : helperText}
      placeholder={withTime ? "۱۴۰۳/۰۵/۲۱ ۱۴:۳۰" : "۱۴۰۳/۰۵/۲۱"}
      inputProps={{ dir: "ltr", inputMode: "numeric", style: { textAlign: "center" }, ...rest.inputProps }}
    />
  );
}
