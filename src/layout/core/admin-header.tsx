"use client";

import { Box, Button, Stack, Typography } from "@mui/material";
import Link from "next/link";
import BarcodeFinder from "../components/barcode";

export default function AdminHeaderDesktop() {
    return <Stack
        component="header"
        direction="row"
        alignItems="center"
        sx={{
            display: { xs: 'none', md: 'flex' },
            minHeight: 72,
            mx: 2,
            mt: 2,
            px: 2,
            zIndex: 99,
            bgcolor: 'rgba(255,255,255,.88)',
            backdropFilter: 'blur(12px)',
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 4,
            position: 'sticky',
            top: 12,
        }}
    >
        <Typography fontWeight={800} variant="subtitle1">
            پنل مدیریت
        </Typography>
        <Box flex="1 1 auto" />
        <BarcodeFinder />
        <Button component={Link} href="/" variant="outlined" sx={{ mr: 1 }}>مشاهده فروشگاه</Button>
    </Stack>
}
