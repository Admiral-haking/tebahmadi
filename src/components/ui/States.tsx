"use client";

import Link from "next/link";
import { Box, Button, Skeleton, Stack, Typography } from "@mui/material";
import { AlertCircle, Inbox, RefreshCw } from "lucide-react";
import { TEB_COLORS, TEB_RADII } from "@/theme/tokens";

export type EmptyStateProps = {
    title: string;
    description?: string;
    actionLabel?: string;
    actionHref?: string;
    onAction?: () => void;
    icon?: React.ReactNode;
};

export function EmptyState({
    title,
    description,
    actionLabel,
    actionHref,
    onAction,
    icon,
}: EmptyStateProps) {
    return (
        <Stack
            alignItems="center"
            justifyContent="center"
            spacing={1.5}
            sx={{
                py: { xs: 5, md: 7 },
                px: 3,
                textAlign: "center",
                borderRadius: `${TEB_RADII.lg}px`,
                bgcolor: TEB_COLORS.surface,
                border: `1px solid ${TEB_COLORS.border}`,
            }}
        >
            <Box
                sx={{
                    width: 56,
                    height: 56,
                    borderRadius: "50%",
                    display: "grid",
                    placeItems: "center",
                    bgcolor: TEB_COLORS.softSurface,
                    color: TEB_COLORS.primary,
                }}
            >
                {icon ?? <Inbox size={26} strokeWidth={1.7} />}
            </Box>
            <Typography variant="h5" sx={{ fontWeight: 700, color: TEB_COLORS.textPrimary }}>
                {title}
            </Typography>
            {description && (
                <Typography variant="body2" sx={{ color: TEB_COLORS.textSecondary, maxWidth: 420 }}>
                    {description}
                </Typography>
            )}
            {actionLabel && actionHref && (
                <Button component={Link} href={actionHref} variant="contained" sx={{ mt: 1 }}>
                    {actionLabel}
                </Button>
            )}
            {actionLabel && !actionHref && onAction && (
                <Button onClick={onAction} variant="contained" sx={{ mt: 1 }}>
                    {actionLabel}
                </Button>
            )}
        </Stack>
    );
}

export type LoadingStateProps = {
    rows?: number;
    height?: number;
};

export function LoadingState({ rows = 4, height = 56 }: LoadingStateProps) {
    return (
        <Stack spacing={1.5} aria-busy="true" aria-label="در حال بارگذاری">
            {Array.from({ length: rows }).map((_, index) => (
                <Skeleton
                    key={index}
                    variant="rounded"
                    height={height}
                    sx={{ borderRadius: `${TEB_RADII.md}px`, bgcolor: TEB_COLORS.softSurface }}
                />
            ))}
        </Stack>
    );
}

export type ErrorStateProps = {
    title?: string;
    description?: string;
    onRetry?: () => void;
    retryLabel?: string;
};

export function ErrorState({
    title = "خطا در دریافت اطلاعات",
    description = "در ارتباط با سرور مشکلی پیش آمد. لطفاً چند لحظه دیگر مجدداً تلاش کنید.",
    onRetry,
    retryLabel = "تلاش مجدد",
}: ErrorStateProps) {
    return (
        <Stack
            alignItems="center"
            justifyContent="center"
            spacing={1.5}
            sx={{
                py: { xs: 5, md: 6 },
                px: 3,
                textAlign: "center",
                borderRadius: `${TEB_RADII.lg}px`,
                bgcolor: TEB_COLORS.errorSoft,
                border: `1px solid #E6C7C8`,
            }}
        >
            <Box
                sx={{
                    width: 52,
                    height: 52,
                    borderRadius: "50%",
                    display: "grid",
                    placeItems: "center",
                    bgcolor: TEB_COLORS.surface,
                    color: TEB_COLORS.error,
                }}
            >
                <AlertCircle size={26} strokeWidth={1.8} />
            </Box>
            <Typography variant="h5" sx={{ fontWeight: 700, color: TEB_COLORS.error }}>
                {title}
            </Typography>
            <Typography variant="body2" sx={{ color: TEB_COLORS.textSecondary, maxWidth: 420 }}>
                {description}
            </Typography>
            {onRetry && (
                <Button
                    onClick={onRetry}
                    variant="outlined"
                    startIcon={<RefreshCw size={16} />}
                    sx={{ borderColor: TEB_COLORS.error, color: TEB_COLORS.error }}
                >
                    {retryLabel}
                </Button>
            )}
        </Stack>
    );
}
