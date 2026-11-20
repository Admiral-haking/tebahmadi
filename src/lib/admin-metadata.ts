import type { Metadata } from "next";
import { BRAND } from "@/config/brand";

export async function buildAdminMetadata(pageTitle: string): Promise<Metadata> {

    return {
        title: `${pageTitle} | ${BRAND.name}`,
        robots: {
            index: false,
        },
    };
}
