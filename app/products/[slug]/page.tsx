import type { Metadata } from "next";
import ProductDetail from "./product-detail";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return { title: `${slug.replace(/-/g, " ")} | طب احمدی`, description: "اطلاعات ترکیبات، روش مصرف و راهنمای انتخاب محصول در طب احمدی" };
}
export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) { return <ProductDetail slug={(await params).slug} />; }
