"use client";

import { useRouter } from "next/navigation";
import { SearchField } from "@/components/ui/SearchField";

export default function HeaderSearch({ size = "md" }: { size?: "sm" | "md" }) {
    const router = useRouter();

    const handleSubmit = (query: string) => {
        if (!query) {
            router.push("/store");
            return;
        }
        router.push(`/search?q=${encodeURIComponent(query)}`);
    };

    return (
        <SearchField
            size={size}
            placeholder={
                size === "sm"
                    ? "جست‌وجو در طب احمدی..."
                    : "جست‌وجو در گیاهان دارویی، دمنوش، روغن و عسل..."
            }
            onSubmit={handleSubmit}
        />
    );
}
