"use client";

import { Get } from "@/utils/fetch";
import {
  Alert,
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
import SnappCredentialsDialog from "./components/snapp-credentials-dialog";
import { snappConnectionFetchUrl } from "@/snapp/connection-cache";
import { summarizeSnappConnection, type SnappConnectionSummary } from "@/snapp/connection-status";
import { isSnappVendorActive, normalizeSnappVendorStatus } from "@/snapp/vendor-status";

export type SnappVendor = {
  id: string;
  title: string;
  title_en: string;
  status: "ACTIVE" | string;
};
type Vendor = SnappVendor[];
export default function SnappHomeView() {
  const [vendors, setVendors] = useState<Record<string, Vendor>>({});
  const [connectionErrors, setConnectionErrors] = useState<Record<string, { code: string; message: string }>>({});
  const [connectionNotice, setConnectionNotice] = useState<SnappConnectionSummary | null>(null);

  const [loading, setLoading] = useState(false);

  const [save, setSave] = useState(false);
  const [authVendor, setAuthVendor] = useState<string | null>(null);

  function handleLoadVendors() {
    setLoading(true);
    Get(snappConnectionFetchUrl())
      .then((res: any) => {
        const nextVendors = res && typeof res === "object" && "vendors" in res ? res.vendors : res;
        setVendors(nextVendors && typeof nextVendors === "object" ? nextVendors : {});
        setConnectionErrors(
          res && typeof res === "object" && res.errors && typeof res.errors === "object" ? res.errors : {},
        );
      })
      .catch(() => toast.error("خطا در بارگیری شعبه‌های اسنپ‌شاپ"))
      .finally(() => setLoading(false));
  }

  function handleAuthToken(vendorId: string) {
    setAuthVendor(vendorId);
  }

  const vendorNames = useMemo(() => Object.keys(vendors), [vendors]);

  useEffect(handleLoadVendors, []);

  return (
    <Container maxWidth="lg" sx={{ my: 4 }}>
      {loading && <LinearProgress />}
      {Object.entries(connectionErrors).map(([vendorId, failure]) => (
        <Alert key={vendorId} severity="warning" sx={{ mb: 1 }}>
          اتصال «{vendorId}» فعال نشد: {failure.message}
        </Alert>
      ))}
      {connectionNotice && (
        <Alert severity={connectionNotice.severity} sx={{ mb: 1 }}>
          {connectionNotice.message}
        </Alert>
      )}
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
                {vendors[item].length
                  ? vendors[item]
                    .map((x) => isSnappVendorActive(x.status) ? "فعال" : `غیرفعال (${normalizeSnappVendorStatus(x.status) || "نامشخص"})`)
                    .join(", ")
                  : "توکن ثبت است؛ شعبه‌ای دریافت نشد"}
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
                            disabled={!isSnappVendorActive(x.status)}
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
      {authVendor && (
        <SnappCredentialsDialog
          open
          vendorId={authVendor}
          onClose={() => setAuthVendor(null)}
          onSuccess={(response) => {
            setConnectionNotice(summarizeSnappConnection(response as { status?: unknown; data?: unknown }));
            handleLoadVendors();
          }}
        />
      )}
    </Container>
  );
}
