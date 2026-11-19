"use client";
import { Box } from "@mui/material";
import Image from "next/image";


type Props = {
    height: string | number

    src: string

    opacity?: number
}


export function BGFadeImage({ height, src, opacity = .5 }: Props) {

    return <Box sx={{
        position: 'absolute',
        top: 0,
        right: 0,
        left: 0,
        zIndex: 0,
        height,
        maskImage: 'linear-gradient(to top, transparent 0%, black 100%)'
    }}>
        <Box
            component={Image}
            src={src}
            fill
            alt="background"
            loading="lazy"
            sx={{
                position: 'absolute',
                top: 0,
                right: 0,
                left: 0,
                bottom: 0,
                objectFit: 'cover',
                height: '100%',
                width: '100%'
            }}
        />
        <Box sx={{
            position: 'absolute',
            top: 0,
            right: 0,
            left: 0,
            bottom: 0,
            opacity,
            bgcolor: 'background.paper'
        }} />
    </Box>
}