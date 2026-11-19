"use client";

import { Box, Container, Stack, Tab, Tabs, Typography } from "@mui/material";
import Image from "next/image";
import { useState } from "react";
import snapp from "@/layout/assets/snapp.jpg";
import { useSearchParams } from "next/navigation";
import SnappProducts from "./components/products";
import SnappOrders from "./components/orders";

export default function SnappPanel({
  vendorId,
  snpVendorId,
}: {
  vendorId: string;
  snpVendorId: string;
}) {
  const searchParams = useSearchParams();

  const tab = searchParams?.get("tab") ?? "1";

  const [tabIndex, setTabIndex] = useState(Number(tab) ?? 1);

  return (
    <Container maxWidth="lg" sx={{ my: 4 }}>
      <Stack direction="row" gap={2} alignItems="center">
        <Box
          component={Image}
          src={snapp}
          width={48}
          height={48}
          alt="snapp"
          sx={{ borderRadius: 0.6 }}
        />
        <Stack sx={{ display: { xs: "none", sm: "flex" } }}>
          <Typography variant="h6">شعبه {vendorId} اسنپ‌شاپ</Typography>
          <Typography variant="caption">مدیریت فروشگاه در اسنپ‌شاپ</Typography>
        </Stack>
        <Box flex="1 1 auto" />
        <Tabs onChange={(_, v) => setTabIndex(v)} value={tabIndex}>
          <Tab value={1} label="سفارش‌ها" />
          <Tab value={2} label="موجودی ها" />
        </Tabs>
      </Stack>

      {tabIndex === 1 && (
        <SnappOrders vendorId={vendorId} snpVendorId={snpVendorId} />
      )}

      {tabIndex === 2 && (
        <SnappProducts vendorId={vendorId} snpVendorId={snpVendorId} />
      )}
    </Container>
  );
}
