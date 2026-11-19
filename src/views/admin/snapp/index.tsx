"use client";

import { Get, POST } from "@/utils/fetch";
import {
  Box,
  Button,
  CircularProgress,
  Container,
  Grid,
  LinearProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import snapp from "@/layout/assets/snapp.jpg";
import Image from "next/image";
import Orderly from "@/components/orderly";
import Link from "next/link";
import { SaveDigikalaVendor } from "../digikala/components/save-vendor";

type Vendor = {
  id: string;
  title: string;
  title_en: string;
  status: "ACTIVE" | string;
}[];
export default function SnappHomeView() {
  const [vendors, setVendors] = useState<Record<string, Vendor>>({});

  const [loading, setLoading] = useState(false);

  const [save, setSave] = useState(false);

  function handleLoadVendors() {
    setLoading(true);
    Get("/api/snapp")
      .then((res) => {
        setVendors(res);
      })
      .catch(() => toast.error("خطا در بارگیری شعبه‌های اسنپ‌شاپ"))
      .finally(() => setLoading(false));
  }

  function handleAuthToken(vendorId: string) {
    const token = window.prompt("لطفا توکن اسنپ‌شاپ را وارد کنید.");
    if (!token) return;

    const client_secret = window.prompt(
      "لطفا کلاینت سکرت اسنپ‌شاپ را وارد کنید.",
    );
    if (!client_secret) return;

    setLoading(true);
    POST("/api/snapp/auth", { vendorId, token, client_secret })
      .then(() => {
        toast.success("اعتبار سنجی انجام شد.");
        handleLoadVendors();
      })
      .catch((err) =>
        toast.error(err.data.message || "خطا در اعتبارسنجی اسنپ‌شاپ"),
      )
      .finally(() => setLoading(false));
  }

  const vendorNames = useMemo(() => Object.keys(vendors), [loading]);

  useEffect(handleLoadVendors, []);

  return (
    <Container maxWidth="lg" sx={{ my: 4 }}>
      {loading && <LinearProgress />}
      <Stack direction="row" gap={2} alignItems="center">
        <Box
          component={Image}
          src={snapp}
          width={48}
          height={48}
          alt="snapp"
          sx={{ borderRadius: 0.6 }}
        />
        <Stack>
          <Typography variant="h4">شعبه‌های اسنپ‌شاپ</Typography>
          <Typography variant="caption">
            لطفا شعبه مورد نظر را انتخاب کنید
          </Typography>
        </Stack>
        <Box flex="1 1 auto" />
        <Button variant="contained" onClick={() => setSave(true)}>
          ایجاد شعبه
        </Button>
      </Stack>

      <Table>
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
          {vendorNames.map((item, i) => (
            <TableRow key={item}>
              <TableCell>{i + 1}</TableCell>
              <TableCell>{item}</TableCell>
              <TableCell align="center">
                {vendors[item].map((x) => x.status).join(", ")}
              </TableCell>
              <TableCell align="center">
                {vendors[item].map((x) => x.title).join(", ")}
              </TableCell>
              <TableCell align="center">
                {vendors[item].map((x) => x.id).join(", ")}
              </TableCell>
              <TableCell align="right">
                <Orderly
                  buttonProps={{
                    children: "عملیات",
                    variant: "contained",
                    size: "small",
                  }}
                  dialogProps={{
                    maxWidth: "sm",
                  }}
                  hideFinish
                  title={item}
                >
                  <Stack gap={4}>
                    <Grid container spacing={1}>
                      <Grid size={{ xs: 12 }}>
                        <Button
                          variant="contained"
                          color="warning"
                          disabled={loading}
                          onClick={() => handleAuthToken(item)}
                          startIcon={loading && <CircularProgress size={16} />}
                          fullWidth
                        >
                          ذخیره توکن
                        </Button>
                      </Grid>
                      {vendors[item].map((x) => (
                        <Grid size={{ xs: 12 }} key={x.id}>
                          <Button
                            variant="contained"
                            disabled={x.status !== "ACTIVE"}
                            LinkComponent={Link}
                            href={`/admin/snapp/${item}/${x.id}`}
                            fullWidth
                          >
                            ورود به {x.title}
                          </Button>
                        </Grid>
                      ))}
                    </Grid>
                  </Stack>
                </Orderly>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <SaveDigikalaVendor
        open={save}
        onClose={() => setSave(false)}
        onUpdate={() => {
          handleLoadVendors();
          setSave(false);
        }}
        service="snapp"
      />
    </Container>
  );
}
