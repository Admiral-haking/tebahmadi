"use client";

import { Box, Chip, Stack, Tooltip, Typography } from "@mui/material";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import Image from "next/image";
import Link from "next/link";

import digikala from "@/layout/assets/digikala.jpeg";
import snapp from "@/layout/assets/snapp.jpg";
import basalaam from "@/layout/assets/basalaam.png";

export type LinePresence = {
  dgk: { dgkProductId: number; dgkVariantId: number; vendorId: string; quantity: number; price: number }[];
  snp: { snpProductId: string; vendorId: string; quantity: number; price: number }[];
  bsl: { bslProductId: number; bslVariantId: number; vendorId: string; quantity: number; price: number }[];
};

const fa = (n: number) => Number(n || 0).toLocaleString("fa-IR");

/**
 * For one order line, show which marketplaces the product is linked on and act as
 * a bridge to their seller panels. Digikala chips deep-link to the seller PWA
 * product page; Snapp/Basalam show their ids + stock in a tooltip.
 */
export default function MarketplacePresence({ presence }: { presence?: LinePresence }) {
  const dgk = presence?.dgk ?? [];
  const snp = presence?.snp ?? [];
  const bsl = presence?.bsl ?? [];

  if (!dgk.length && !snp.length && !bsl.length) {
    return <Typography variant="caption" color="text.secondary">در هیچ پنلی متصل نیست</Typography>;
  }

  return (
    <Stack direction="row" gap={0.5} flexWrap="wrap">
      {dgk.map((d, i) => (
        <Tooltip key={`d${i}`} title={`دیجی‌کالا · پنل «${d.vendorId}» — کالا ${fa(d.dgkProductId)} · واریانت ${fa(d.dgkVariantId)} · موجودی ${fa(d.quantity)}`}>
          <Chip
            component={Link as any}
            href={`https://seller.digikala.com/pwa/product/${d.dgkProductId}/variant`}
            target="_blank"
            rel="noopener noreferrer"
            clickable
            size="small"
            color="error"
            variant="outlined"
            sx={{ pl: 0.25, fontWeight: 600, maxWidth: 200 }}
            icon={<Box component={Image} src={digikala} width={16} height={16} alt="digikala" style={{ borderRadius: 3 }} />}
            label={<Stack direction="row" alignItems="center" gap={0.3}>دیجی‌کالا: {d.vendorId}<OpenInNewRoundedIcon sx={{ fontSize: 13 }} /></Stack>}
          />
        </Tooltip>
      ))}
      {snp.map((s, i) => (
        <Tooltip key={`s${i}`} title={`اسنپ‌شاپ · پنل «${s.vendorId}» — کد ${s.snpProductId} · موجودی ${fa(s.quantity)}`}>
          <Chip size="small" color="warning" variant="outlined" sx={{ pl: 0.25, fontWeight: 600, maxWidth: 200 }}
            icon={<Box component={Image} src={snapp} width={16} height={16} alt="snapp" style={{ borderRadius: 3 }} />}
            label={`اسنپ‌شاپ: ${s.vendorId}`} />
        </Tooltip>
      ))}
      {bsl.map((b, i) => (
        <Tooltip key={`b${i}`} title={`باسلام · پنل «${b.vendorId}» — کالا ${fa(b.bslProductId)} · واریانت ${fa(b.bslVariantId)} · موجودی ${fa(b.quantity)}`}>
          <Chip size="small" color="success" variant="outlined" sx={{ pl: 0.25, fontWeight: 600, maxWidth: 200 }}
            icon={<Box component={Image} src={basalaam} width={16} height={16} alt="basalaam" style={{ borderRadius: 3 }} />}
            label={`باسلام: ${b.vendorId}`} />
        </Tooltip>
      ))}
    </Stack>
  );
}
