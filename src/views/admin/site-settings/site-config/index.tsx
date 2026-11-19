'use client';

import { Breadcrumbs, Chip, Container, Link as MuiLink, Stack, Typography } from "@mui/material";
import Link from "next/link";
import { useMemo } from "react";
import { useSiteConfig } from "../hooks";
import SiteConfigForm from "./site-config-form";

export default function SiteConfigSettingsView() {
    const { data, status, envSummary, envHealth, loading, error, refresh } = useSiteConfig();

    const statusChip = useMemo(() => {
        if (loading) {
            return <Chip label="در حال بررسی..." color="default" />;
        }
        if (status) {
            return <Chip label="پیکربندی کامل" color="success" variant="outlined" />;
        }
        return <Chip label="پیکربندی ناقص" color="warning" variant="outlined" />;
    }, [loading, status]);

    return <Container maxWidth="lg" sx={{ py: { xs: 4, md: 6 } }}>
        <Stack spacing={3}>
            <Breadcrumbs aria-label="breadcrumb">
                <MuiLink component={Link} href="/admin" underline="hover" color="inherit">
                    داشبورد
                </MuiLink>
                <Typography color="text.primary">پیکربندی سایت</Typography>
            </Breadcrumbs>

            <Stack spacing={1} direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }}>
                <Stack spacing={1}>
                    <Typography variant="h4" fontWeight={700}>
                        تنظیمات پیکربندی سایت
                    </Typography>
                    <Typography variant="body1" color="text.secondary" maxWidth={720}>
                        کلیدهای ضروری و مقادیر پیکربندی را مدیریت کنید تا مراحل راه‌اندازی سایت تکمیل شود.
                    </Typography>
                </Stack>
                {statusChip}
            </Stack>

            <SiteConfigForm
                data={data}
                envSummary={envSummary}
                envHealth={envHealth}
                loading={loading}
                error={error}
                refresh={refresh}
            />
        </Stack>
    </Container>
}
