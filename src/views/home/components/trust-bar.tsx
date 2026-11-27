import { Box, Container, Stack, Typography } from "@mui/material";
import { BrandIcon } from "@/components/brand-icons";

type TrustItem = {
  label: string;
  sub: string;
  icon: React.ReactNode;
};

const ITEMS: TrustItem[] = [
  {
    label: "ارسال سریع",
    sub: "سراسر کشور",
    icon: <BrandIcon name="shipping" size={22} />,
  },
  {
    label: "ضمانت اصالت",
    sub: "تضمین کیفیت کالا",
    icon: <BrandIcon name="authenticity" size={22} />,
  },
  {
    label: "پشتیبانی",
    sub: "پاسخگوی شما هستیم",
    icon: <BrandIcon name="support" size={22} />,
  },
  {
    label: "پرداخت امن",
    sub: "درگاه معتبر بانکی",
    icon: <BrandIcon name="payment" size={22} />,
  },
];

export default function TrustBar() {
  return (
    <Container maxWidth="lg" sx={{ px: { xs: 1.5, sm: 2 }, my: { xs: 4, md: 7 } }}>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "repeat(2, 1fr)", md: "repeat(4, 1fr)" },
          gap: { xs: 0, md: 1.5 },
          border: 1,
          borderColor: "divider",
          borderRadius: 6,
          bgcolor: "background.paper",
          py: { xs: 1.5, sm: 2 },
          px: { xs: 0.5, sm: 1.5 },
          boxShadow: "0 14px 44px rgba(42, 90, 68, .07)",
        }}
      >
        {ITEMS.map((item) => (
          <Stack
            key={item.label}
            alignItems="center"
            spacing={0.25}
            sx={{ textAlign: "center", color: "text.primary", p: 1.25 }}
          >
            <Box sx={{ color: "primary.main", display: "flex", mb: 0.5 }}>{item.icon}</Box>
            <Typography sx={{ fontSize: { xs: 12, sm: 14 }, fontWeight: 700, lineHeight: 1.3 }}>
              {item.label}
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ fontSize: { xs: 9, sm: 11 }, display: { xs: "none", sm: "block" } }}
            >
              {item.sub}
            </Typography>
          </Stack>
        ))}
      </Box>
    </Container>
  );
}
