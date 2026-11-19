"use client";

import { Button, Stack, TextField } from "@mui/material";
import axios from "axios";
import { useState } from "react";
import { toast } from "sonner";

type DgkStockPatchControlProps = {
    vendorId: string;
    dgkVariantId: number;
    initialStock: number;
    disabled?: boolean;
    onUpdated?: (stock: number) => void;
};

export default function DgkStockPatchControl({
    vendorId,
    dgkVariantId,
    initialStock,
    disabled,
    onUpdated,
}: DgkStockPatchControlProps) {
    const [stock, setStock] = useState(Math.max(0, Math.floor(Number(initialStock) || 0)));
    const [saving, setSaving] = useState(false);

    async function handleSave() {
        if (!Number.isFinite(stock) || stock < 0) {
            toast.error("موجودی معتبر نیست.");
            return;
        }

        setSaving(true);
        try {
            await axios.patch("/api/digikala/inventory", {
                vendorId,
                dgkVariantId,
                stock: Math.max(0, Math.floor(stock)),
            });
            toast.success("موجودی واریانت در دیجی‌کالا بروزرسانی شد.");
            onUpdated?.(Math.max(0, Math.floor(stock)));
        } catch {
            toast.error("بروزرسانی موجودی دیجی‌کالا انجام نشد.");
        } finally {
            setSaving(false);
        }
    }

    return (
        <Stack direction="row" gap={0.75} alignItems="center" sx={{ minWidth: 190 }}>
            <TextField
                type="number"
                size="small"
                label="موجودی"
                value={stock}
                onChange={(event) => setStock(Math.max(0, Math.floor(Number(event.target.value) || 0)))}
                disabled={disabled || saving}
                inputProps={{ min: 0 }}
                sx={{ width: 92 }}
            />
            <Button
                size="small"
                variant="outlined"
                onClick={handleSave}
                disabled={disabled || saving || !vendorId || !dgkVariantId}
            >
                اعمال
            </Button>
        </Stack>
    );
}
