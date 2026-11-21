"use client";

import { useEffect, useState } from "react";
import { Box, IconButton, InputBase, type SxProps, type Theme } from "@mui/material";
import { Search, X } from "lucide-react";
import { TEB_COLORS } from "@/theme/tokens";

export type SearchFieldProps = {
    value?: string;
    defaultValue?: string;
    placeholder?: string;
    debounceMs?: number;
    onDebouncedChange?: (value: string) => void;
    onSubmit?: (value: string) => void;
    onChange?: (value: string) => void;
    size?: "sm" | "md";
    ariaLabel?: string;
    sx?: SxProps<Theme>;
};

export function SearchField({
    value,
    defaultValue = "",
    placeholder = "جست‌وجو در گیاهان دارویی، دمنوش، روغن و عسل...",
    debounceMs = 350,
    onDebouncedChange,
    onSubmit,
    onChange,
    size = "md",
    ariaLabel = "جست‌وجوی محصولات",
    sx,
}: SearchFieldProps) {
    const isControlled = typeof value === "string";
    const [internalValue, setInternalValue] = useState(value ?? defaultValue);

    useEffect(() => {
        if (isControlled) {
            setInternalValue(value);
        }
    }, [isControlled, value]);

    useEffect(() => {
        if (!onDebouncedChange) return;
        const handle = window.setTimeout(() => {
            onDebouncedChange(internalValue);
        }, debounceMs);
        return () => window.clearTimeout(handle);
    }, [internalValue, debounceMs, onDebouncedChange]);

    const handleChange = (next: string) => {
        if (!isControlled) {
            setInternalValue(next);
        }
        onChange?.(next);
    };

    const handleClear = () => {
        handleChange("");
        onDebouncedChange?.("");
    };

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        onSubmit?.(internalValue.trim());
    };

    const minHeight = size === "sm" ? 42 : 48;

    return (
        <Box
            component="form"
            onSubmit={handleSubmit}
            role="search"
            sx={{
                display: "flex",
                alignItems: "center",
                width: "100%",
                minHeight,
                px: 1.5,
                borderRadius: "9999px",
                bgcolor: TEB_COLORS.softSurface,
                border: `1px solid ${TEB_COLORS.border}`,
                transition: "border-color 0.2s ease, background-color 0.2s ease, box-shadow 0.2s ease",
                "&:focus-within": {
                    bgcolor: TEB_COLORS.surface,
                    borderColor: TEB_COLORS.primary,
                    boxShadow: "0 0 0 3px rgba(42, 90, 68, 0.12)",
                },
                ...sx,
            }}
        >
            <IconButton
                type="submit"
                size="small"
                aria-label="اجرای جست‌وجو"
                sx={{
                    width: 36,
                    height: 36,
                    color: TEB_COLORS.primary,
                }}
            >
                <Search size={18} strokeWidth={2} />
            </IconButton>

            <InputBase
                value={internalValue}
                onChange={(e) => handleChange(e.target.value)}
                placeholder={placeholder}
                inputProps={{ "aria-label": ariaLabel }}
                sx={{
                    flex: 1,
                    px: 1,
                    fontSize: size === "sm" ? "13px" : "14px",
                    color: TEB_COLORS.textPrimary,
                    "& input::placeholder": {
                        color: TEB_COLORS.textSecondary,
                        opacity: 0.85,
                    },
                }}
            />

            {internalValue.length > 0 && (
                <IconButton
                    size="small"
                    onClick={handleClear}
                    aria-label="پاک کردن جست‌وجو"
                    sx={{
                        width: 32,
                        height: 32,
                        color: TEB_COLORS.textSecondary,
                    }}
                >
                    <X size={16} />
                </IconButton>
            )}
        </Box>
    );
}
