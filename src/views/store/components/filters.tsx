"use client";

import { useMemo, useState } from "react";
import {
    Box,
    Button,
    Chip,
    Checkbox,
    Divider,
    Drawer,
    FormControl,
    FormControlLabel,
    FormGroup,
    IconButton,
    Stack,
    Typography,
} from "@mui/material";
import { useRouter, usePathname } from "next/navigation";
import type { StoreViewSearchParams } from "..";
import type { StoreFilterAttribute } from "../data";

type Props = {
    attributes: StoreFilterAttribute[];
    searchParams: StoreViewSearchParams;
};

type ParsedAttributeFilters = Record<string, string[]>;

function parseAttributeFilters(searchParams: StoreViewSearchParams): ParsedAttributeFilters {
    const attributes: ParsedAttributeFilters = {};
    Object.entries(searchParams).forEach(([key, value]) => {
        if (!key.startsWith("attr.")) {
            return;
        }
        const attrKey = key.slice(5);
        const list = Array.isArray(value) ? value : value ? [value] : [];
        const normalized = list.map((item) => `${item}`.trim()).filter((item) => item.length > 0);
        if (normalized.length > 0) {
            attributes[attrKey] = normalized;
        }
    });
    return attributes;
}

function countAppliedAttributes(filters: ParsedAttributeFilters): number {
    return Object.values(filters).reduce((total, values) => total + values.length, 0);
}

function normalizeAttributes(
    attributes: ParsedAttributeFilters,
    allowed: StoreFilterAttribute[],
): ParsedAttributeFilters {
    const allowedKeys = new Set(allowed.map((attr) => attr.key));
    const next: ParsedAttributeFilters = {};
    Object.entries(attributes).forEach(([key, values]) => {
        if (allowedKeys.has(key) && values.length > 0) {
            next[key] = Array.from(new Set(values));
        }
    });
    return next;
}

export default function StoreFilters({ attributes, searchParams }: Props) {
    const router = useRouter();
    const pathname = usePathname();
    const parsed = useMemo(() => parseAttributeFilters(searchParams), [searchParams]);
    const [open, setOpen] = useState(false);
    const [attributeValues, setAttributeValues] = useState<ParsedAttributeFilters>(() =>
        normalizeAttributes(parsed, attributes),
    );

    const appliedCount = countAppliedAttributes(parsed);

    const handleOpen = () => {
        setAttributeValues(normalizeAttributes(parsed, attributes));
        setOpen(true);
    };

    const handleClose = () => setOpen(false);

    const handleToggleAttribute = (key: string, value: string) => {
        setAttributeValues((prev) => {
            const current = new Set(prev[key] ?? []);
            if (current.has(value)) {
                current.delete(value);
            } else {
                current.add(value);
            }
            if (current.size === 0) {
                const next = { ...prev };
                delete next[key];
                return next;
            }
            return { ...prev, [key]: Array.from(current) };
        });
    };

    const buildQuery = (override?: ParsedAttributeFilters) => {
        const params = new URLSearchParams(window.location.search);
        Array.from(params.keys())
            .filter((key) => key.startsWith("attr."))
            .forEach((key) => params.delete(key));
        params.delete("page");

        const nextAttributes = override ?? attributeValues;
        Object.entries(nextAttributes).forEach(([key, values]) => {
            values.forEach((value) => {
                params.append(`attr.${key}`, value);
            });
        });
        return params;
    };

    const applyFilters = () => {
        const params = buildQuery();
        const queryString = params.toString();
        router.push(queryString ? `${pathname}?${queryString}` : pathname || "/");
        setOpen(false);
    };

    const clearFilters = () => {
        setAttributeValues({});
        const params = buildQuery({});
        const queryString = params.toString();
        router.push(queryString ? `${pathname}?${queryString}` : pathname || "/");
        setOpen(false);
    };

    return (
        <>
            <Button
                startIcon={
                    <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24">
                        <g fill="none">
                            <path d="m12.593 23.258l-.011.002l-.071.035l-.02.004l-.014-.004l-.071-.035q-.016-.005-.024.005l-.004.01l-.017.428l.005.02l.01.013l.104.074l.015.004l.012-.004l.104-.074l.012-.016l.004-.017l-.017-.427q-.004-.016-.017-.018m.265-.113l-.013.002l-.185.093l-.01.01l-.003.011l.018.43l.005.012l.008.007l.201.093q.019.005.029-.008l.004-.014l-.034-.614q-.005-.018-.02-.022m-.715.002a.02.02 0 0 0-.027.006l-.006.014l-.034.614q.001.018.017.024l.015-.002l.201-.093l.01-.008l.004-.011l.017-.43l-.003-.012l-.01-.01z"></path>
                            <path fill="currentColor" d="M14 16.5a1.5 1.5 0 0 1 .144 2.993L14 19.5h-4a1.5 1.5 0 0 1-.144-2.993L10 16.5zm3-6a1.5 1.5 0 0 1 0 3H7a1.5 1.5 0 0 1 0-3zm3-6a1.5 1.5 0 0 1 0 3H4a1.5 1.5 0 1 1 0-3z"></path>
                        </g>
                    </svg>
                }
                variant="text"
                size="large"
                onClick={handleOpen}
                sx={{
                    bgcolor: "background.paper",
                    color: "text.primary",
                    display: "flex",
                    gap: 1,
                    alignItems: "center",
                }}
            >
                فیلتر
                {appliedCount > 0 && <Chip label={appliedCount} size="small" color="primary" />}
            </Button>

            <Drawer anchor="right" open={open} onClose={handleClose} PaperProps={{ sx: { width: { xs: "100%", sm: 360 } } }}>
                <Stack sx={{ p: 3, height: "100%" }} spacing={3}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between">
                        <Typography variant="h6">فیلترها</Typography>
                        <IconButton onClick={handleClose} aria-label="close filters">
                            <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24">
                                <path
                                    fill="currentColor"
                                    d="m6.4 19l-1.4-1.4l5.6-5.6l-5.6-5.6l1.4-1.4l5.6 5.6l5.6-5.6l1.4 1.4l-5.6 5.6l5.6 5.6l-1.4 1.4l-5.6-5.6z"
                                />
                            </svg>
                        </IconButton>
                    </Stack>

                    <Divider />

                    <Stack spacing={2} sx={{ flex: "1 1 auto", overflowY: "auto" }}>
                        {attributes.length === 0 ? (
                            <Typography variant="body2" color="text.secondary">
                                فیلتری برای این دسته‌بندی در دسترس نیست.
                            </Typography>
                        ) : (
                            attributes.map((attribute) => (
                                <FormControl key={attribute.key} component="fieldset">
                                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                                        {attribute.label}
                                    </Typography>
                                    <FormGroup>
                                        {attribute.options.map((option) => {
                                            const selected = new Set(attributeValues[attribute.key] ?? []);
                                            const checked = selected.has(option.value);
                                            return (
                                                <FormControlLabel
                                                    key={option.value}
                                                    control={
                                                        <Checkbox
                                                            checked={checked}
                                                            onChange={() => handleToggleAttribute(attribute.key, option.value)}
                                                        />
                                                    }
                                                    label={
                                                        <Stack direction="row" alignItems="center" spacing={1}>
                                                            {option.swatches && option.swatches.length > 0 && (
                                                                <Box
                                                                    sx={{
                                                                        width: 16,
                                                                        height: 16,
                                                                        borderRadius: "50%",
                                                                        border: "1px solid var(--mui-palette-divider)",
                                                                        background:
                                                                            option.swatches.length > 1
                                                                                ? `linear-gradient(90deg, ${option.swatches.join(", ")})`
                                                                                : option.swatches[0],
                                                                    }}
                                                                />
                                                            )}
                                                            <Typography variant="body2">{option.label}</Typography>
                                                        </Stack>
                                                    }
                                                />
                                            );
                                        })}
                                    </FormGroup>
                                </FormControl>
                            ))
                        )}
                    </Stack>

                    <Divider />

                    <Stack direction="row" spacing={2}>
                        <Button fullWidth variant="contained" onClick={applyFilters} disabled={attributes.length === 0 && appliedCount === 0}>
                            اعمال فیلتر
                        </Button>
                        <Button fullWidth variant="outlined" color="secondary" onClick={clearFilters} disabled={appliedCount === 0}>
                            حذف فیلترها
                        </Button>
                    </Stack>
                </Stack>
            </Drawer>
        </>
    );
}
