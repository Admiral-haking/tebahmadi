import type { Metadata } from "next";

import OrdersView from "@/views/orders";
import { generatePageMetadata } from "@/seo/services/metadataGenerator";
import { requireAuthenticatedUser } from "@/lib/require-auth";

export async function generateMetadata(): Promise<Metadata> {
  const { metadata } = await generatePageMetadata({
    slug: "/orders",
    defaults: {
      title: "سفارش‌های من",
      description: "سفارش‌های خود را دنبال کنید، وضعیت ارسال را ببینید و رسید پرداخت را مرور کنید.",
    },
  });
  return metadata;
}

export default async function Page() {
  await requireAuthenticatedUser("/orders");
  return <OrdersView />;
}
