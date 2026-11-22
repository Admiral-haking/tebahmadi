"use client";

import { IconButton, Stack, Typography } from "@mui/material";
import { Minus, Plus, Trash2 } from "lucide-react";
import { TEB_COLORS } from "@/theme/tokens";
import { formatFaNumber } from "@/lib/format";

export type QuantityControlProps = {
    value: number;
    min?: number;
    max?: number;
    disabled?: boolean;
    allowRemoveAtMin?: boolean;
    onChange: (next: number) => void;
    onRemove?: () => void;
    size?: "sm" | "md";
};

export function QuantityControl({
    value,
    min = 1,
    max = 99,
    disabled = false,
    allowRemoveAtMin = false,
    onChange,
    onRemove,
    size = "md",
}: QuantityControlProps) {
    const canIncrement = !disabled && value < max;
    const canDecrement = !disabled && (value > min || (allowRemoveAtMin && value <= min && Boolean(onRemove)));
    const buttonSize = size === "sm" ? 36 : 44;

    const handleDecrement = () => {
        if (disabled) return;
        if (value <= min) {
            if (allowRemoveAtMin && onRemove) {
                onRemove();
            }
            return;
        }
        onChange(Math.max(min, value - 1));
    };

    const handleIncrement = () => {
        if (!canIncrement) return;
        onChange(Math.min(max, value + 1));
    };

    const handleKeyDown = (event: React.KeyboardEvent) => {
        if (event.key === "ArrowUp" || event.key === "+") {
            event.preventDefault();
            handleIncrement();
        } else if (event.key === "ArrowDown" || event.key === "-") {
            event.preventDefault();
            handleDecrement();
        }
    };

    const showTrash = allowRemoveAtMin && value <= min && Boolean(onRemove);

    return (
        <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            role="spinbutton"
            aria-label="تعداد محصول"
            aria-valuenow={value}
            aria-valuemin={min}
            aria-valuemax={max}
            tabIndex={0}
            onKeyDown={handleKeyDown}
            sx={{
                display: "inline-flex",
                borderRadius: "10px",
                border: `1px solid ${TEB_COLORS.border}`,
                bgcolor: TEB_COLORS.surface,
                p: 0.25,
                minWidth: size === "sm" ? 108 : 132,
                fontVariantNumeric: "tabular-nums",
            }}
        >
            <IconButton
                size="small"
                onClick={handleIncrement}
                disabled={!canIncrement}
                aria-label="افزایش تعداد"
                sx={{
                    width: buttonSize,
                    height: buttonSize,
                    color: TEB_COLORS.primary,
                    "&:hover": { bgcolor: TEB_COLORS.softSurface },
                }}
            >
                <Plus size={16} />
            </IconButton>

            <Typography
                component="span"
                sx={{
                    minWidth: 32,
                    textAlign: "center",
                    fontSize: size === "sm" ? "14px" : "16px",
                    fontWeight: 700,
                    color: TEB_COLORS.textPrimary,
                }}
            >
                {formatFaNumber(value)}
            </Typography>

            <IconButton
                size="small"
                onClick={handleDecrement}
                disabled={!canDecrement}
                aria-label={showTrash ? "حذف از سبد" : "کاهش تعداد"}
                sx={{
                    width: buttonSize,
                    height: buttonSize,
                    color: showTrash ? TEB_COLORS.error : TEB_COLORS.textPrimary,
                    "&:hover": { bgcolor: showTrash ? TEB_COLORS.errorSoft : TEB_COLORS.softSurface },
                }}
            >
                {showTrash ? <Trash2 size={16} /> : <Minus size={16} />}
            </IconButton>
        </Stack>
    );
}
