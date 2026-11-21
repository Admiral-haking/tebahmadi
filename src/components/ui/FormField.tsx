"use client";

import { FormControl, FormHelperText, InputLabel, TextField, type TextFieldProps } from "@mui/material";
import { TEB_COLORS } from "@/theme/tokens";

export type FormFieldProps = TextFieldProps & {
    helperError?: string;
};

export function FormField({ helperError, error, helperText, ...rest }: FormFieldProps) {
    return (
        <TextField
            fullWidth
            error={Boolean(error || helperError)}
            helperText={helperError ?? helperText}
            {...rest}
        />
    );
}

export function FormFieldGroup({
    label,
    error,
    children,
}: {
    label?: string;
    error?: string;
    children: React.ReactNode;
}) {
    return (
        <FormControl fullWidth error={Boolean(error)}>
            {label && (
                <InputLabel shrink sx={{ position: "static", transform: "none", mb: 0.75, fontSize: "13px", fontWeight: 600, color: TEB_COLORS.textPrimary }}>
                    {label}
                </InputLabel>
            )}
            {children}
            {error && <FormHelperText>{error}</FormHelperText>}
        </FormControl>
    );
}
