"use client";

import { useEffect } from "react";
import { IconButton, useColorScheme } from "@mui/material";

export default function ModeButton() {
    const { mode, setMode } = useColorScheme();

    useEffect(() => {
        if (!mode) return;

        document.cookie = `mui-mode=${mode}; path=/; max-age=31536000; SameSite=Lax`;
    }, [mode]);

    return <IconButton
        aria-label={mode === 'dark' ? "فعال‌کردن حالت روشن" : "فعال‌کردن حالت تاریک"}
        onClick={() => setMode(mode === 'dark' ? "light" : "dark")}
    >
        {
            mode === "dark" ?
                <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24">
                    <path fill="currentColor" d="M17 12a5 5 0 1 1-10 0a5 5 0 0 1 10 0"></path>
                    <path fill="currentColor" fillRule="evenodd" d="M12 1.25a.75.75 0 0 1 .75.75v2a.75.75 0 0 1-1.5 0V2a.75.75 0 0 1 .75-.75M1.25 12a.75.75 0 0 1 .75-.75h2a.75.75 0 0 1 0 1.5H2a.75.75 0 0 1-.75-.75m18 0a.75.75 0 0 1 .75-.75h2a.75.75 0 0 1 0 1.5h-2a.75.75 0 0 1-.75-.75M12 19.25a.75.75 0 0 1 .75.75v2a.75.75 0 0 1-1.5 0v-2a.75.75 0 0 1 .75-.75" clipRule="evenodd"></path>
                    <path fill="currentColor" d="M3.67 3.716a.75.75 0 0 1 1.059-.048L6.95 5.7a.75.75 0 0 1-1.012 1.107L3.717 4.775a.75.75 0 0 1-.048-1.06m16.663.001a.75.75 0 0 1-.047 1.06l-2.223 2.03A.75.75 0 1 1 17.05 5.7l2.222-2.032a.75.75 0 0 1 1.06.048m-3.306 13.309a.75.75 0 0 1 1.06 0l2.223 2.222a.75.75 0 1 1-1.061 1.06l-2.222-2.222a.75.75 0 0 1 0-1.06m-10.051 0a.75.75 0 0 1 0 1.06l-2.222 2.223a.75.75 0 0 1-1.06-1.06l2.222-2.223a.75.75 0 0 1 1.06 0" opacity={0.5}></path>
                </svg>
                :
                <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24">
                    <path fill="currentColor" d="M12 22c5.523 0 10-4.477 10-10c0-.463-.694-.54-.933-.143a6.5 6.5 0 1 1-8.924-8.924C12.54 2.693 12.463 2 12 2C6.477 2 2 6.477 2 12s4.477 10 10 10" opacity={0.5}></path>
                    <path fill="currentColor" d="M11.286 22C13.337 22 15 20.42 15 18.47c0-1.544-1.045-2.857-2.5-3.336C12.295 13.371 10.72 12 8.81 12c-2.052 0-3.715 1.58-3.715 3.53c0 .43.082.844.23 1.226a3 3 0 0 0-.54-.05C3.248 16.706 2 17.89 2 19.353S3.247 22 4.786 22z"></path>
                </svg>
        }
    </IconButton>
}
