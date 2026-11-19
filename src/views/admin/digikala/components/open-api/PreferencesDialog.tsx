"use client";

import {
    Button, Dialog, DialogActions, DialogContent,
    DialogTitle, Divider, Grid, TextField, Typography,
} from "@mui/material";
import type { Preferences } from "./types";
import DialogCloseButton from "../dialog-close-button";

type Props = {
    open: boolean;
    preferences: Preferences;
    saving: boolean;
    onChange: (patch: Partial<Preferences>) => void;
    onSave: () => void;
    onClose: () => void;
};

const FIELDS: { key: keyof Preferences; label: string; helper: string }[] = [
    { key: "callbackUrl", label: "آدرس وبهوک", helper: "آدرس سایت + /api/digikala/webhook" },
    { key: "defaultWarehouseId", label: "شناسه انبار پیش‌فرض", helper: "از پنل دیجی‌کالا" },
    { key: "defaultBoxSizeId", label: "شناسه جعبه پیش‌فرض", helper: "برای ارسال" },
    { key: "defaultCancellationReasonId", label: "دلیل لغو پیش‌فرض", helper: "کد دلیل لغو" },
    { key: "defaultCityIds", label: "شناسه شهرها", helper: "با ویرگول، مثال: 1,2,3" },
    { key: "defaultTimeScopeIds", label: "شناسه بازه‌های زمانی", helper: "با ویرگول" },
    { key: "defaultLeadTime", label: "زمان آماده‌سازی", helper: "مثال: 1 (روز)" },
    { key: "questionAnswerTemplate", label: "متن آماده پاسخ سوالات", helper: "جایگزین خودکار در فرم پاسخ" },
];

export default function PreferencesDialog({ open, preferences, saving, onChange, onSave, onClose }: Props) {
    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle sx={{ position: "relative", pr: 6 }}>
                <DialogCloseButton onClose={onClose} disabled={saving} />
                <Typography variant="h6" fontWeight={800}>تنظیمات پیش‌فرض فروشنده</Typography>
                <Typography variant="caption" color="text.secondary" display="block" mt={0.5}>
                    این مقادیر در دیتابیس ذخیره می‌شوند و هنگام اجرای عملیات‌ها به‌صورت خودکار در فرم‌ها قرار می‌گیرند.
                </Typography>
            </DialogTitle>

            <Divider />

            <DialogContent sx={{ pt: 2.5 }}>
                <Grid container spacing={2}>
                    {FIELDS.map((field) => (
                        <Grid key={field.key} size={{ xs: 12, sm: 6 }}>
                            <TextField
                                size="small"
                                label={field.label}
                                helperText={field.helper}
                                value={preferences[field.key]}
                                onChange={(e) => onChange({ [field.key]: e.target.value })}
                                fullWidth
                            />
                        </Grid>
                    ))}
                </Grid>
            </DialogContent>

            <Divider />

            <DialogActions sx={{ px: 3, py: 2 }}>
                <Button variant="outlined" onClick={onClose} disabled={saving}>
                    بستن
                </Button>
                <Button variant="contained" onClick={onSave} disabled={saving}>
                    {saving ? "در حال ذخیره..." : "ذخیره تنظیمات"}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
