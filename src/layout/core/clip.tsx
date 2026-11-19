"use client";

import { alpha, Box } from "@mui/material";
import { green, orange, red, yellow } from "@mui/material/colors";
import { useEffect, useState } from "react";

export default function ThemeClip() {

    const [color, setColor] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => { setColor(l => l === 3 ? 0 : l + 1) }, 5e3);

        return () => clearInterval(interval);
    }, [])
    return <Box sx={{
        position: 'relative',
        width: '100%',
    }}>
        <Box
            sx={{
                position: 'absolute',
                width: '100vw',
                height: '100vw',
                backgroundColor: alpha(colors[color], (color + 1.5) / 10),
                top: 0,
                bottom: 0,
                left: 0,
                right: 0,
                transform: 'translateY(-80%)',
                borderRadius: `${color % 2 === 0 ? '50' : color * 10}%`,
                transition: 'all 5s linear'
            }}
        />
    </Box>
}

const colors = [red[600], green[600], yellow[400], orange[500]]