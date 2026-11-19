"use client";

import { Get, POST } from "@/utils/fetch";
import { Box, Button, CircularProgress, Container, Grid, LinearProgress, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import basalaam from "@/layout/assets/basalaam.png";
import Image from "next/image";
import Orderly from "@/components/orderly";
import Link from "next/link";
import { SaveDigikalaVendor } from "../digikala/components/save-vendor";

type Vendor = {
    status: string,
    vendor: {
        id: number; // Vendor ID
        identifier: string; // Vendor identifier
        title: string;
    }
    desc: string
}
export default function BasalaamHomeView() {
    const [vendors, setVendors] = useState<Record<string, Vendor>>({});

    const [loading, setLoading] = useState(false);

    const [save, setSave] = useState(false);


    function handleLoadVendors() {
        setLoading(true)
        Get("/api/basalaam")
            .then(res => {
                setVendors(res);
            })
            .catch(() => toast.error("خطا در بارگیری شعبه های باسلام"))
            .finally(() => setLoading(false));
    }

    function handleAuthToken(vendorId: string) {
        const auth_token = window.prompt("لطفا توکن باسلام را وارد کنید.");
        if (!auth_token) return;

        setLoading(true)
        POST("/api/basalaam/auth", { vendorId, auth_token })
            .then(() => {
                toast.success("اعتبار سنجی انجام شد.")
                handleLoadVendors();
            })
            .catch(() => toast.error("خطای اعتبار سنجی: از صحت کلید ها و زمان کد اعتبار سنجی اطمینان حاصل کنید."))
            .finally(() => setLoading(false))

    }

    const vendorNames = useMemo(() => Object.keys(vendors), [vendors]);


    useEffect(handleLoadVendors, []);

    return <Container maxWidth="lg" sx={{ my: 4 }}>

        {loading && <LinearProgress />}
        <Stack direction="row" gap={2} alignItems="center">
            <Box
                component={Image}
                src={basalaam}
                width={48}
                height={48}
                alt="basalaam"
                sx={{ borderRadius: .6 }}
            />
            <Stack>
                <Typography variant="h4">
                    شعبه های باسلام
                </Typography>
                <Typography variant="caption">
                    لطفا شعبه مورد نظر را انتخاب کنید
                </Typography>
            </Stack>
            <Box flex="1 1 auto" />
            <Button variant="contained" onClick={() => setSave(true)}>
                ایجاد شعبه
            </Button>
        </Stack>

        <TableContainer>

            <Table sx={{ minWidth: 1024 }}>
                <TableHead>
                    <TableRow>
                        <TableCell>#</TableCell>
                        <TableCell>نام شعبه</TableCell>
                        <TableCell align="center">وضعیت</TableCell>
                        <TableCell align="center">نام</TableCell>
                        <TableCell align="center">ای دی</TableCell>
                        <TableCell align="right">عملیات</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {
                        vendorNames.map((item, i) => <TableRow key={item}>
                            <TableCell>{i + 1}</TableCell>
                            <TableCell>{item}</TableCell>
                            <TableCell align="center">
                                {vendors[item].status}
                            </TableCell>
                            <TableCell align="center">
                                {vendors[item].vendor?.title || "همگام نشده"}
                            </TableCell>
                            <TableCell align="center">{vendors[item].vendor?.id || "همگام نشده"}</TableCell>
                            <TableCell align="right">
                                <Orderly
                                    buttonProps={{
                                        children: "عملیات",
                                        variant: "contained",
                                        size: "small"
                                    }}
                                    dialogProps={{
                                        maxWidth: 'sm'
                                    }}
                                    hideFinish
                                    title={item}
                                >
                                    <Grid container spacing={1}>
                                        <Grid size={{ xs: 12 }}>
                                            <Button
                                                variant="contained"
                                                color="warning"
                                                disabled={vendors[item].status === "فعال" || loading}
                                                onClick={() => handleAuthToken(item)}
                                                startIcon={loading && <CircularProgress size={16} />}
                                                fullWidth>
                                                ذخیره توکن
                                            </Button>
                                        </Grid>
                                        <Grid size={{ xs: 12 }}>
                                            <Button
                                                variant="contained"
                                                disabled={vendors[item].status !== "فعال"}
                                                LinkComponent={Link}
                                                href={`/admin/basalaam/${item}`}
                                                fullWidth>
                                                ورود به مدیریت
                                            </Button>
                                        </Grid>
                                    </Grid>

                                </Orderly>
                            </TableCell>
                        </TableRow>)
                    }
                </TableBody>
            </Table>
        </TableContainer>

        <SaveDigikalaVendor
            open={save}
            onClose={() => setSave(false)}
            onUpdate={() => {
                handleLoadVendors();
                setSave(false)
            }}
            service="basalaam"
        />
    </Container>
}