import { Box, Container, Stack, Typography } from "@mui/material";

type TrustItem = {
  label: string;
  sub: string;
  icon: React.ReactNode;
};

const ITEMS: TrustItem[] = [
  {
    label: "ارسال سریع",
    sub: "سراسر کشور",
    icon: (
      <svg width={22} height={22} viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M3 7h11v8H3z M14 10h4l3 3v2h-7z" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" />
        <circle cx="7" cy="17" r="1.6" stroke="currentColor" strokeWidth={1.5} />
        <circle cx="17" cy="17" r="1.6" stroke="currentColor" strokeWidth={1.5} />
      </svg>
    ),
  },
  {
    label: "ضمانت اصالت",
    sub: "تضمین کیفیت کالا",
    icon: (
      <svg width={22} height={22} viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" />
        <path d="m9 12 2 2 4-4" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    label: "پشتیبانی",
    sub: "پاسخگوی شما هستیم",
    icon: (
      <svg width={22} height={22} viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M5 11a7 7 0 0 1 14 0v4a2 2 0 0 1-2 2h-1v-6h3M5 11v6a2 2 0 0 0 2 2h1v-6H5" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    label: "پرداخت امن",
    sub: "درگاه معتبر بانکی",
    icon: (
      <svg width={22} height={22} viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="3" y="6" width="18" height="12" rx="2" stroke="currentColor" strokeWidth={1.5} />
        <path d="M3 10h18" stroke="currentColor" strokeWidth={1.5} />
      </svg>
    ),
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
