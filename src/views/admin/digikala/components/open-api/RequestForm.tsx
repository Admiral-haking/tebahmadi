"use client";

import {
    Alert, Box, Button, Chip, Collapse, Divider,
    MenuItem, Paper, Stack, TextField, Typography,
} from "@mui/material";
import AutoFixHighRoundedIcon from "@mui/icons-material/AutoFixHighRounded";
import SendRoundedIcon from "@mui/icons-material/SendRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import { useState } from "react";
import type { DgkOpenApiEndpoint } from "@/digikala/constants/open-api-catalog";
import type { BodyField, Method } from "./types";
import { GROUP_LABELS, METHOD_COLORS, METHOD_LABELS, WRITE_METHODS } from "./constants";
import { endpointGuide, persianActionTitle, persianPlaceholderLabel } from "./utils";

type Props = {
    selectedEndpoint: DgkOpenApiEndpoint | null;
    method: Method;
    placeholders: string[];
    pathParams: Record<string, string>;
    bodyFields: BodyField[];
    bodyFieldValues: Record<string, string>;
    fileUpload: boolean;
    fileFieldName: string;
    file: File | null;
    loading: boolean;
    hasMissingPathParam: boolean;
    showAdvanced: boolean;
    rawDownload: boolean;
    downloadable: boolean;
    url: string;
    body: string;
    aiPrompt: string;
    aiLoading: boolean;
    onPathParamChange: (key: string, value: string) => void;
    onBodyFieldChange: (key: string, value: string) => void;
    onFileFieldNameChange: (v: string) => void;
    onFileChange: (f: File | null) => void;
    onRawDownloadToggle: () => void;
    onShowAdvancedToggle: () => void;
    onBodyChange: (v: string) => void;
    onAiPromptChange: (v: string) => void;
    onAiFill: () => void;
    onSend: () => void;
};

export default function RequestForm({
    selectedEndpoint, method, placeholders, pathParams,
    bodyFields, bodyFieldValues, fileUpload, fileFieldName, file,
    loading, hasMissingPathParam, showAdvanced, rawDownload, downloadable,
    url, body, aiPrompt, aiLoading,
    onPathParamChange, onBodyFieldChange, onFileFieldNameChange, onFileChange,
    onRawDownloadToggle, onShowAdvancedToggle, onBodyChange, onAiPromptChange,
    onAiFill, onSend,
}: Props) {
    const [aiExpanded, setAiExpanded] = useState(false);

    if (!selectedEndpoint) {
        return (
            <Box sx={{ py: 8, textAlign: "center" }}>
                <Typography variant="h6" color="text.disabled" sx={{ mb: 1 }}>
                    یک عملیات انتخاب کنید
                </Typography>
                <Typography variant="body2" color="text.disabled">
                    از لیست سمت چپ یک عملیات را انتخاب کنید تا فرم مخصوص آن نمایش داده شود.
                </Typography>
            </Box>
        );
    }

    const guide = endpointGuide(method, selectedEndpoint.path, selectedEndpoint.group, selectedEndpoint.title);
    const isWrite = WRITE_METHODS.has(method);
    const titleFa = persianActionTitle(selectedEndpoint.title, selectedEndpoint.path, method);

    return (
        <Stack spacing={2.5}>
            {/* Header */}
            <Stack spacing={0.75}>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
                    <Chip
                        size="small"
                        label={METHOD_LABELS[method]}
                        color={METHOD_COLORS[method]}
                        sx={{ fontWeight: 700 }}
                    />
                    <Chip
                        size="small"
                        label={GROUP_LABELS[selectedEndpoint.group] ?? selectedEndpoint.group}
                        variant="outlined"
                    />
                    {fileUpload && <Chip size="small" label="نیازمند فایل" color="secondary" />}
                    {downloadable && (
                        <Chip
                            size="small"
                            label={rawDownload ? "دانلود مستقیم ✓" : "نمایش در صفحه"}
                            color={rawDownload ? "success" : "default"}
                            onClick={onRawDownloadToggle}
                            sx={{ cursor: "pointer" }}
                        />
                    )}
                </Stack>
                <Typography variant="subtitle1" fontWeight={700}>
                    {titleFa}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    {guide.purpose}
                </Typography>
            </Stack>

            <Alert
                severity={isWrite ? "warning" : "info"}
                sx={{ borderRadius: 2, py: 0.75 }}
            >
                {guide.risk}
                {guide.tip && ` ${guide.tip}`}
            </Alert>

            {/* Path parameters */}
            {placeholders.length > 0 && (
                <Stack spacing={1}>
                    <Typography variant="subtitle2" fontWeight={700}>
                        شناسه‌های مسیر
                    </Typography>
                    {placeholders.map((key) => (
                        <TextField
                            key={key}
                            size="small"
                            label={persianPlaceholderLabel(key)}
                            helperText={`نام فنی: ${key}`}
                            value={pathParams[key] ?? ""}
                            onChange={(e) => onPathParamChange(key, e.target.value)}
                            fullWidth
                            dir="ltr"
                            error={!pathParams[key]?.trim()}
                        />
                    ))}
                </Stack>
            )}

            {/* Body fields */}
            {method !== "GET" && bodyFields.length > 0 && (
                <Stack spacing={1}>
                    <Typography variant="subtitle2" fontWeight={700}>
                        اطلاعات درخواست
                    </Typography>
                    {bodyFields.map((field) => (
                        <TextField
                            key={field.key}
                            select={field.type === "boolean"}
                            size="small"
                            label={`${field.label}${field.required ? " *" : ""}`}
                            helperText={field.helper}
                            value={bodyFieldValues[field.key] ?? ""}
                            onChange={(e) => onBodyFieldChange(field.key, e.target.value)}
                            multiline={field.type === "json"}
                            minRows={field.type === "json" ? 3 : undefined}
                            type={field.type === "number" ? "number" : "text"}
                            dir={field.type === "text" ? "rtl" : "ltr"}
                            fullWidth
                            error={field.required && !bodyFieldValues[field.key]?.trim()}
                        >
                            {field.type === "boolean" ? [
                                <MenuItem key="true" value="true">بله / فعال</MenuItem>,
                                <MenuItem key="false" value="false">خیر / غیرفعال</MenuItem>,
                            ] : null}
                        </TextField>
                    ))}
                </Stack>
            )}

            {method !== "GET" && bodyFields.length === 0 && !fileUpload && (
                <Alert severity="info" sx={{ borderRadius: 2 }}>
                    این عملیات فرم ساختارمند ندارد و با مقدار پیش‌فرض امن ارسال می‌شود.
                    حالت پیشرفته را برای ویرایش مستقیم فعال کنید.
                </Alert>
            )}

            {/* File upload */}
            {fileUpload && (
                <Stack spacing={1}>
                    <Typography variant="subtitle2" fontWeight={700}>آپلود فایل</Typography>
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems="flex-start">
                        <TextField
                            size="small"
                            label="نام فیلد فایل"
                            value={fileFieldName}
                            onChange={(e) => onFileFieldNameChange(e.target.value)}
                            sx={{ minWidth: 160 }}
                            dir="ltr"
                        />
                        <Button variant="outlined" size="small" component="label">
                            انتخاب فایل
                            <input type="file" hidden onChange={(e) => onFileChange(e.target.files?.[0] ?? null)} />
                        </Button>
                        {file && (
                            <Chip label={file.name} onDelete={() => onFileChange(null)} size="small" />
                        )}
                    </Stack>
                </Stack>
            )}

            {/* AI Fill */}
            {(placeholders.length > 0 || method !== "GET") && (
                <Paper elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, overflow: "hidden" }}>
                    <Stack
                        direction="row"
                        alignItems="center"
                        justifyContent="space-between"
                        sx={{ px: 1.5, py: 1, cursor: "pointer", bgcolor: aiExpanded ? "action.hover" : "transparent" }}
                        onClick={() => setAiExpanded((v) => !v)}
                    >
                        <Stack direction="row" spacing={1} alignItems="center">
                            <AutoFixHighRoundedIcon fontSize="small" color="primary" />
                            <Typography variant="subtitle2" fontWeight={700}>پر کردن با هوش مصنوعی</Typography>
                        </Stack>
                        <ExpandMoreRoundedIcon
                            fontSize="small"
                            sx={{ transition: "transform .2s", transform: aiExpanded ? "rotate(180deg)" : "none" }}
                        />
                    </Stack>
                    <Collapse in={aiExpanded}>
                        <Stack spacing={1.5} sx={{ p: 1.5, pt: 0.5 }}>
                            <Typography variant="body2" color="text.secondary">
                                توضیح ساده بنویسید — هوش مصنوعی فیلدها را براساس قوانین دیجی‌کالا پر می‌کند.
                            </Typography>
                            <TextField
                                size="small"
                                placeholder="مثال: موجودی تنوع ۱۲۳۴۵ را ۸ کن"
                                value={aiPrompt}
                                onChange={(e) => onAiPromptChange(e.target.value)}
                                multiline
                                minRows={2}
                                fullWidth
                            />
                            <Button
                                variant="outlined"
                                size="small"
                                startIcon={<AutoFixHighRoundedIcon />}
                                onClick={onAiFill}
                                disabled={aiLoading}
                            >
                                {aiLoading ? "در حال پر کردن..." : "پر کردن فرم"}
                            </Button>
                        </Stack>
                    </Collapse>
                </Paper>
            )}

            {/* Advanced mode */}
            {showAdvanced && (
                <Stack spacing={1}>
                    <Divider />
                    <Typography variant="caption" dir="ltr" color="text.secondary" sx={{ overflowWrap: "anywhere", fontFamily: "monospace" }}>
                        {url}
                    </Typography>
                    {method !== "GET" && (
                        <TextField
                            size="small"
                            label="درخواست JSON"
                            value={body}
                            onChange={(e) => onBodyChange(e.target.value)}
                            multiline
                            minRows={5}
                            fullWidth
                            dir="ltr"
                            slotProps={{ input: { sx: { fontFamily: "monospace", fontSize: 13 } } }}
                        />
                    )}
                </Stack>
            )}

            {/* Actions */}
            <Stack direction="row" spacing={1}>
                <Button
                    variant="contained"
                    size="large"
                    startIcon={<SendRoundedIcon />}
                    onClick={onSend}
                    disabled={loading || hasMissingPathParam}
                    sx={{ flex: "1 1 auto" }}
                >
                    {loading ? "در حال ارسال..." : "ارسال به دیجی‌کالا"}
                </Button>
                <Button
                    variant="outlined"
                    size="large"
                    onClick={onShowAdvancedToggle}
                    color={showAdvanced ? "warning" : "inherit"}
                >
                    {showAdvanced ? "ساده" : "پیشرفته"}
                </Button>
            </Stack>
        </Stack>
    );
}
