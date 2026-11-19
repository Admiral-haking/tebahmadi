import { Breadcrumbs, Container, Link as MuiLink, Stack, Typography } from "@mui/material";
import Link from "next/link";
import SiteInfoForm from "./site-info-form";

export default function SiteInfoSettingsView() {
    return <Container maxWidth="lg" sx={{ py: { xs: 4, md: 6 } }}>
        <Stack spacing={3}>
            <Breadcrumbs aria-label="breadcrumb">
                <MuiLink component={Link} href="/admin" underline="hover" color="inherit">
                    داشبورد
                </MuiLink>
                <Typography color="text.primary">اطلاعات سایت</Typography>
            </Breadcrumbs>

            <Stack spacing={1}>
                <Typography variant="h4" fontWeight={700}>
                    تنظیمات اطلاعات پایه سایت
                </Typography>
                <Typography variant="body1" color="text.secondary" maxWidth={720}>
                    نام برند، راه‌های ارتباطی و شبکه‌های اجتماعی خود را در این بخش مدیریت کنید تا در تمام بخش‌های وب‌سایت به‌صورت هماهنگ نمایش داده شوند.
                </Typography>
            </Stack>

            <SiteInfoForm />
        </Stack>
    </Container>
}
