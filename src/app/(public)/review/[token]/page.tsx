import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ReviewPage from "@/views/review";

type PageProps = {
    params: Promise<{ token: string }>;
};

export const dynamic = "force-dynamic";

export function generateMetadata(): Metadata {
    return {
        title: "ثبت نظر خرید",
        description: "امتیاز و تجربه خود را از خریدتان ثبت کنید.",
    };
}

export default async function Page({ params }: PageProps) {
    const { token } = await params;
    if (!token) {
        notFound();
    }
    return <ReviewPage token={token} />;
}
