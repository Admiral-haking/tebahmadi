"use client";

import { useWindowHeight } from "@/hooks/window-height";
import { Box, Button } from "@mui/material";
import Image from "next/image";
import Link from "next/link";


export default function DesktopCustomLinks({ links = [] }: { links?: any[] }) {
    const height = useWindowHeight();

    const remain = height < 512 ? 0 : height - 512;

    const count = Math.trunc(remain / 70);

    return links.slice(0, count).map((item: any) => <Button
        LinkComponent={Link}
        href={item.href}
        key={item.title}
        startIcon={<Box sx={{
            width: 32,
            height: 32,
            position: 'relative',
            borderRadius: '50%',
            overflow: 'hidden'
        }}>
            <Image
                src={item.icon}
                alt={item.title}
                fill
                loading="lazy"
                objectFit="cover"
                fetchPriority="low"
                style={{
                    maxHeight: 32,
                    maxWidth: 32
                }}
            />
        </Box>}>
        {item.title}
    </Button>)
}