"use server"
import { loadSiteInfo } from "@/lib/cache";
import { Box } from "@mui/material";


type Props = {
    height: string | number

    opacity?: number
}


export async function BGFadeVideo({ height, opacity = .5 }: Props) {

    const site_info = await loadSiteInfo();

    if (!site_info?.customData?.["videoBackground"]) return null;

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
            component="video"
            src={site_info?.customData?.["videoBackground"]}
            autoPlay
            loop
            muted
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