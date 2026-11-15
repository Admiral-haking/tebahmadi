import type { Metadata } from "next";
import "./globals.css";
import "./admin-navigation.css";
import "./storefront-polish.css";
import "./brand-theme.css";
import { NavigationBehavior } from "@/components/navigation-behavior";

export const metadata: Metadata = {
  title: "طب احمدی | فروشگاه سلامت و مراقبت",
  description: "فروشگاه طب احمدی؛ محصولات گیاهی و مراقبتی، سفارش آنلاین و حساب کاربری مشتریان",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://tebahmadi.ir"),
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl">
      <body className="antialiased"><NavigationBehavior />{children}</body>
    </html>
  );
}
