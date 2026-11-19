import type { Metadata } from "next";

export async function buildAdminMetadata(pageTitle: string): Promise<Metadata> {

    return {
        title: `${pageTitle}`,
        robots: {
            index: false,
        },
    };
}
