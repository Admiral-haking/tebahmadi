"use client";

import { CircularProgress, Stack, Switch, Typography } from "@mui/material";
import axios from "axios";
import { useState } from "react";
import { toast } from "sonner";

type Props = {
    vendorId: string;
    dgkVariantId: number;
    active: boolean;
    disabled?: boolean;
    /** Called with the confirmed new value after a successful update. */
    onChanged?: (active: boolean) => void;
};

/**
 * Optimistic activation toggle for a single Digikala variant.
 * Flips immediately, PATCHes /api/digikala/activation, and reverts on failure.
 */
export default function DgkActivationToggle({
    vendorId,
    dgkVariantId,
    active,
    disabled,
    onChanged,
}: Props) {
    const [value, setValue] = useState(active);
    const [saving, setSaving] = useState(false);

    async function toggle(next: boolean) {
        const prev = value;
        setValue(next); // optimistic
        setSaving(true);
        try {
            await axios.patch("/api/digikala/activation", { vendorId, dgkVariantId, activation: next });
            toast.success(next ? "واریانت فعال شد" : "واریانت غیرفعال شد");
            onChanged?.(next);
        } catch (e: any) {
            setValue(prev); // revert
            toast.error(e?.response?.data?.error || "خطا در به‌روزرسانی وضعیت");
        } finally {
            setSaving(false);
        }
    }

    return (
        <Stack direction="row" alignItems="center" gap={0.5} sx={{ minWidth: 110 }}>
            <Switch
                size="small"
                checked={value}
                disabled={disabled || saving || !vendorId || !dgkVariantId}
                onChange={(e) => toggle(e.target.checked)}
                color="success"
            />
            {saving ? (
                <CircularProgress size={14} />
            ) : (
                <Typography variant="caption" color={value ? "success.main" : "text.secondary"}>
                    {value ? "فعال" : "غیرفعال"}
                </Typography>
            )}
        </Stack>
    );
}
