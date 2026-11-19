"use client";

import { Box, Button, CircularProgress, Container, Grid, LinearProgress, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from "@mui/material";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import digikala from "@/layout/assets/digikala.jpeg";
import Image from "next/image";
import { SaveDigikalaVendor } from "./components/save-vendor";
import { CheckBox, Error as ErrorIcon } from "@mui/icons-material";
import Orderly from "@/components/orderly";
import { SaveDigikalaKeys } from "./components/pairs-dialog";
import Link from "next/link";

type Vendor = {
    keys: boolean;
    validated: boolean;
    expires: string;
};

const dateFormatter = new Intl.DateTimeFormat("fa-IR", {
    dateStyle: "medium",
    timeStyle: "short",
});

export default function DigikalaHomeView() {
    const [vendors, setVendors] = useState<Record<string, Vendor>>({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [save, setSave] = useState(false);
    const [keyDialog, setKeyDialog] = useState("");
    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;
        return () => { mountedRef.current = false; };
    }, []);

    function handleLoadVendors() {
        setLoading(true);
        setError(null);
        fetch("/api/digikala?service=dgk", { credentials: "include" })
            .then(async (r) => {
                if (!r.ok) throw new Error(await r.text());
                return r.json() as Promise<Record<string, Vendor>>;
            })
            .then((res) => { if (mountedRef.current) setVendors(res); })
            .catch(() => {
                if (!mountedRef.current) return;
                setError("خطا در بارگیری شعبه‌های دیجی‌کالا");
                toast.error("خطا در بارگیری شعبه‌های دیجی‌کالا");
            })
            .finally(() => { if (mountedRef.current) setLoading(false); });
    }

    function handleGenerateKeys(vendorId: string) {
        if (!window.confirm("کلیدهای قبلی از دسترس خارج خواهند شد. از این عملیات اطمینان دارید؟")) return;

        setLoading(true);
        fetch("/api/digikala/auth?vendorId=" + encodeURIComponent(vendorId), { credentials: "include" })
            .then(async (r) => {
                if (!r.ok) throw new Error(await r.text());
                return r.json() as Promise<{ publicKey: string }>;
            })
            .then((res) => {
                const blob = new Blob([res.publicKey], { type: "text/plain" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "public.txt";
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                toast.success("کلیدهای عمومی و خصوصی ساخته شدند. کلید عمومی دانلود شد.");
                toast.info("کلید عمومی را در اختیار دیجی‌کالا قرار دهید. سپس اقدام به اعتبارسنجی کنید.");
                handleLoadVendors();
            })
            .catch((err) => {
                if (!mountedRef.current) return;
                const msg = err instanceof Error ? err.message : "";
                toast.error(msg ? `خطا در ساخت کلیدها: ${msg}` : "خطا در ساخت کلیدهای دیجی‌کالا");
            })
            .finally(() => { if (mountedRef.current) setLoading(false); });
    }

    function handleAuthToken(vendorId: string) {
        const authorization_code = window.prompt("لطفا کد اعتبارسنجی دیجی‌کالا را وارد کنید:");
        if (!authorization_code?.trim()) return;

        setLoading(true);
        fetch("/api/digikala/auth", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ vendorId, authorization_code: authorization_code.trim() }),
        })
            .then(async (r) => {
                if (!r.ok) {
                    const payload = await r.json().catch(() => ({})) as { error?: string };
                    throw new Error(payload?.error || "auth_failed");
                }
                return r.json();
            })
            .then(() => {
                if (!mountedRef.current) return;
                toast.success("اعتبارسنجی با موفقیت انجام شد.");
                handleLoadVendors();
            })
            .catch((err) => {
                if (!mountedRef.current) return;
                const msg = err instanceof Error ? err.message : "";
                toast.error(msg ? `خطای اعتبارسنجی: ${msg}` : "خطای اعتبارسنجی: از صحت کلیدها و زمان کد اطمینان حاصل کنید.");
            })
            .finally(() => { if (mountedRef.current) setLoading(false); });
    }

    const vendorNames = useMemo(() => Object.keys(vendors), [vendors]);

    useEffect(handleLoadVendors, []);

    return <Container maxWidth="lg" sx={{ my: 4 }}>

        {loading && <LinearProgress />}
        {error && (
            <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}
                sx={{ mb: 2, p: 2, border: 1, borderColor: "error.light", borderRadius: 2, bgcolor: "rgba(var(--mui-palette-error-mainChannel) / 0.08)" }}>
                <Typography variant="body2" color="error.main">{error}</Typography>
                <Button variant="outlined" color="error" size="small" disabled={loading} onClick={handleLoadVendors}>تلاش دوباره</Button>
            </Stack>
        )}
        <Stack direction="row" gap={2} alignItems="center">
            <Box
                component={Image}
                src={digikala}
                width={48}
                height={48}
                alt="digikala"
                sx={{ borderRadius: .6 }}
            />
            <Stack>
                <Typography variant="h4">
                    شعبه های دیجی کالا
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

        <TableContainer sx={{ overflowX: "auto" }}>
            <Table sx={{ minWidth: 1400 }}>
                <TableHead>
                    <TableRow>
                        <TableCell>#</TableCell>
                        <TableCell>نام شعبه</TableCell>
                        <TableCell align="center">کلید ها</TableCell>
                        <TableCell align="center">اعتبار سنجی</TableCell>
                        <TableCell align="center">اعتبار</TableCell>
                        <TableCell align="right">عملیات</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {
                        vendorNames.map((item, i) => <TableRow key={item}>
                            <TableCell>{i + 1}</TableCell>
                            <TableCell>{item}</TableCell>
                            <TableCell align="center">
                                {vendors[item].keys ? <CheckBox /> : <ErrorIcon />}
                            </TableCell>
                            <TableCell align="center">
                                {vendors[item].validated ? <CheckBox /> : <ErrorIcon />}
                            </TableCell>
                            <TableCell align="center">{!!vendors[item].expires ? dateFormatter.format(new Date(vendors[item].expires)) : <ErrorIcon />}</TableCell>
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
                                        <Grid size={{ xs: 6 }}>
                                            <Button
                                                variant="contained"
                                                color="secondary"
                                                disabled={loading}
                                                onClick={() => handleGenerateKeys(item)}
                                                startIcon={loading && <CircularProgress size={16} />}
                                                fullWidth>
                                                ساخت کلید ها
                                            </Button>
                                        </Grid>
                                        <Grid size={{ xs: 6 }}>
                                            <Button
                                                variant="contained"
                                                color="primary"
                                                disabled={loading}
                                                onClick={() => setKeyDialog(item)}
                                                fullWidth>
                                                ذخیره دستی کلیدها
                                            </Button>
                                        </Grid>
                                        <Grid size={{ xs: 12 }}>
                                            <Button
                                                variant="contained"
                                                color="warning"
                                                disabled={!vendors[item].keys || loading}
                                                onClick={() => handleAuthToken(item)}
                                                startIcon={loading && <CircularProgress size={16} />}
                                                fullWidth>
                                                ارسال کد اعتبار سنجی
                                            </Button>
                                        </Grid>
                                        <Grid size={{ xs: 12 }}>
                                            <Button
                                                variant="contained"
                                                disabled={!vendors[item].validated || !(!!vendors[item].expires && new Date(vendors[item].expires).getTime() > Date.now())}
                                                LinkComponent={Link}
                                                href={`/admin/digikala/${item}`}
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
        />
        <SaveDigikalaKeys
            open={!!keyDialog}
            onClose={() => setKeyDialog("")}
            onUpdate={() => {
                handleLoadVendors();
                setKeyDialog("");
                toast.info("کلید عمومی را در اختیار دیجی کالا قرار دهید. سپس اقدام به اعتبار سنجی کنید.");

            }}
            vendorId={keyDialog}
        />
    </Container>
}