"use client";

import {
  Alert,
  Box,
  Chip,
  Container,
  Divider,
  Grid,
  List,
  ListItem,
  ListItemText,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import {
  CategoryRounded,
  Inventory2Rounded,
  LocalShippingRounded,
  PaymentsRounded,
  ReceiptLongRounded,
  SettingsRounded,
  StorefrontRounded,
  SyncRounded,
} from "@mui/icons-material";

const guides = [
  {
    title: "محصولات و تنوع‌ها",
    href: "/admin/catalog/products",
    icon: <StorefrontRounded />,
    items: ["ثبت یا ویرایش کالا", "مدیریت عکس، قیمت، بارکد و موجودی", "بررسی تنوع‌های فعال و ناموجود"],
  },
  {
    title: "سفارش‌ها و فاکتورها",
    href: "/admin/orders",
    icon: <ReceiptLongRounded />,
    items: ["مشاهده جزئیات فاکتور", "تغییر وضعیت سفارش", "ثبت کد رهگیری و مرحله ارسال"],
  },
  {
    title: "مقایسه و سینک موجودی",
    href: "/admin/inventory-comparison",
    icon: <Inventory2Rounded />,
    items: ["پیدا کردن اختلاف موجودی", "سینک تکی یا گروهی", "بررسی کالاهای بدون اتصال به سرویس"],
  },
  {
    title: "مارکت‌پلیس‌ها",
    href: "/admin/marketplace-health",
    icon: <SyncRounded />,
    items: ["بررسی سلامت اتصال‌ها", "پیگیری خطاهای سینک", "کنترل وضعیت دیجی‌کالا، اسنپ و باسلام"],
  },
  {
    title: "ارسال و حمل",
    href: "/admin/transport",
    icon: <LocalShippingRounded />,
    items: ["تعریف روش ارسال", "تنظیم هزینه و محدوده", "غیرفعال کردن روش‌های قدیمی"],
  },
  {
    title: "تنظیمات سایت",
    href: "/admin/settings/site-info",
    icon: <SettingsRounded />,
    items: ["ویرایش اطلاعات و لوگوی سایت", "تنظیم پیامک‌ها", "کنترل تنظیمات عمومی فروشگاه"],
  },
  {
    title: "تخفیف‌ها و پرداخت",
    href: "/admin/offers",
    icon: <PaymentsRounded />,
    items: ["ساخت کد تخفیف", "کنترل کیفیت پرداخت‌ها", "بررسی وضعیت درگاه‌ها"],
  },
  {
    title: "دسته‌بندی‌ها",
    href: "/admin/catalog/categories",
    icon: <CategoryRounded />,
    items: ["ساخت دسته جدید", "ویرایش ساختار فروشگاه", "اتصال کالاها به دسته درست"],
  },
  {
    title: "حسابداری هلو",
    href: "/admin/holoo",
    icon: <ReceiptLongRounded />,
    items: [
      "اتصال هر پنل مارکت‌پلیس به طرف‌حساب هلو",
      "نگاشت پریفیکس بارکد به گروه فرعی حسابداری",
      "بررسی وضعیت اتصال و فاکتورهای ارسال‌شده",
    ],
  },
  {
    title: "کنترل کیفیت پرداخت",
    href: "/admin/payment-quality",
    icon: <PaymentsRounded />,
    items: ["بررسی نرخ موفقیت درگاه‌ها", "مشاهده خطاهای اخیر پرداخت", "تشخیص افت کیفیت درگاه"],
  },
  {
    title: "لاگ خطاها",
    href: "/admin/error-logs",
    icon: <SettingsRounded />,
    items: ["پیگیری خطاهای سیستم و سینک", "فیلتر بر اساس منبع و شدت", "ریشه‌یابی مشکلات مارکت‌پلیس"],
  },
  {
    title: "رهگیری سفارش‌ها",
    href: "/admin/tracking",
    icon: <LocalShippingRounded />,
    items: ["مشاهده کد رهگیری مرسوله‌ها", "وضعیت واقعی سفارش‌های مارکت‌پلیس", "کپی متن رهگیری برای مشتری"],
  },
];

const dailyChecklist = [
  "داشبورد را برای سفارش‌های جدید و پرداخت‌های امروز بررسی کنید.",
  "در سفارش‌ها، وضعیت سفارش‌های پرداخت‌شده را به مرحله آماده‌سازی منتقل کنید.",
  "در مقایسه موجودی، ابتدا اختلاف‌ها را فیلتر کنید و بعد سینک گروهی بزنید.",
  "اگر خطای سینک دیدید، صفحه لاگ خطاها و سلامت مارکت‌پلیس‌ها را بررسی کنید.",
  "بعد از تغییر قیمت یا موجودی مهم، یک بار مقایسه موجودی را بروزرسانی کنید.",
];

export default function AdminHelpView() {
  return (
    <Container maxWidth="xl" sx={{ py: { xs: 3, md: 4 } }} dir="rtl">
      <Stack spacing={3}>
        <Paper
          elevation={0}
          sx={{
            p: { xs: 2.5, md: 4 },
            borderRadius: 3,
            color: "common.white",
            background: "linear-gradient(135deg, var(--mui-palette-success-dark) 0%, var(--mui-palette-grey-900) 100%)",
          }}
        >
          <Stack spacing={1.25}>
            <Chip label="راهنمای داخلی مدیران" sx={{ alignSelf: "flex-start", color: "var(--mui-palette-grey-900)", bgcolor: "common.white" }} />
            <Typography variant="h4" fontWeight={950}>
              آموزش کار با پنل مدیریت
            </Typography>
            <Typography variant="body1" sx={{ maxWidth: 820, opacity: 0.86, lineHeight: 1.9 }}>
              این صفحه مسیرهای اصلی پنل را برای کارهای روزانه فروشگاه، سفارش‌ها، موجودی و سرویس‌های بیرونی خلاصه می‌کند.
            </Typography>
          </Stack>
        </Paper>

        <Alert severity="info" sx={{ borderRadius: 2 }}>
          پیشنهاد عملی: برای هر تغییر موجودی، اول کالا را در پنل محصولات اصلاح کنید و سپس از «مقایسه موجودی» سینک را انجام دهید.
        </Alert>

        <Grid container spacing={2}>
          {guides.map((guide) => (
            <Grid key={guide.title} size={{ xs: 12, md: 6, xl: 3 }}>
              <Paper
                component="a"
                href={guide.href}
                elevation={0}
                sx={{
                  display: "block",
                  height: "100%",
                  p: 2.25,
                  borderRadius: 2,
                  border: "1px solid rgba(var(--mui-palette-primary-mainChannel) / 0.16)",
                  color: "text.primary",
                  textDecoration: "none",
                  bgcolor: "background.paper",
                  transition: "transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease, background-color 0.2s ease",
                  "&:hover": {
                    borderColor: "rgba(var(--mui-palette-primary-mainChannel) / 0.38)",
                    bgcolor: "rgba(var(--mui-palette-primary-mainChannel) / 0.04)",
                    transform: "translateY(-3px)",
                    boxShadow: "0 10px 24px rgba(var(--mui-palette-primary-mainChannel) / 0.15)",
                  },
                }}
              >
                <Stack spacing={1.5}>
                  <Box sx={{ color: "var(--mui-palette-primary-main)", display: "flex" }}>{guide.icon}</Box>
                  <Typography variant="h6" fontWeight={900}>
                    {guide.title}
                  </Typography>
                  <Divider />
                  <List dense disablePadding>
                    {guide.items.map((item) => (
                      <ListItem key={item} disableGutters sx={{ py: 0.25 }}>
                        <ListItemText primary={item} slotProps={{ primary: { variant: "body2", color: "text.secondary" } }} />
                      </ListItem>
                    ))}
                  </List>
                </Stack>
              </Paper>
            </Grid>
          ))}
        </Grid>

        <Paper elevation={0} sx={{ p: { xs: 2, md: 3 }, borderRadius: 2, border: 1, borderColor: "divider" }}>
          <Typography variant="h6" fontWeight={950} gutterBottom>
            چک‌لیست روزانه مدیر
          </Typography>
          <List>
            {dailyChecklist.map((item, index) => (
              <ListItem key={item} disableGutters>
                <ListItemText primary={`${index + 1}. ${item}`} />
              </ListItem>
            ))}
          </List>
        </Paper>
      </Stack>
    </Container>
  );
}
