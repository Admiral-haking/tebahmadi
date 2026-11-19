"use client"

import { createTheme, SupportedColorScheme } from "@mui/material"
import colorSchemes from "./schema";
import localFont from "next/font/local";

export const defaultFont = localFont({
    variable: "--font-default",
    display: 'swap',
    src: [
        { path: "../../public/fonts/Peyda-Regular.woff2", weight: "400", style: "normal" },
        { path: "../../public/fonts/Peyda-Medium.woff2", weight: "500", style: "normal" },
        { path: "../../public/fonts/Peyda-SemiBold.woff2", weight: "600", style: "normal" },
        { path: "../../public/fonts/Peyda-Bold.woff2", weight: "700", style: "normal" },
    ],
    preload: true,
    fallback: ['tahoma', 'helvetica', 'arial', 'sans-serif'],
});

const useCreateTheme = (defaultColorScheme?: SupportedColorScheme | undefined) => createTheme({
    cssVariables: {
        colorSchemeSelector: 'class'
    },
    direction: 'rtl',
    colorSchemes,
    defaultColorScheme,
    shape: {
        borderRadius: 8
    },
    typography: {
        fontFamily: defaultFont.style.fontFamily,
    },
    components: {
        MuiCssBaseline: {
            styleOverrides: () => ({
                body: {
                    WebkitFontSmoothing: 'antialiased',
                    MozOsxFontSmoothing: 'grayscale',
                    margin: 0,
                    padding: 0,
                },
                a: {
                    color: "var(--mui-palette-primary-main)",
                    textDecoration: 'none',
                },
                "*": { scrollbarWidth: "thin", scrollbarColor: "var(--mui-palette-grey-600) var(--mui-palette-grey-900)" },
                "*::-webkit-scrollbar": { width: "6px" },
                "*::-webkit-scrollbar-track": { background: "var(--mui-palette-grey-900)" },
                "*::-webkit-scrollbar-thumb": {
                    backgroundColor: "var(--mui-palette-grey-600)",
                    borderRadius: "6px",
                    border: "2px solid var(--mui-palette-grey-900)"
                },
                // Improve image rendering to prevent CLS
                "img, video": {
                    maxWidth: "100%",
                    height: "auto",
                },
                "iframe": {
                    maxWidth: "100%",
                },
            }),
        },
        MuiContainer: {
            defaultProps: {
                // Ensure containers don't cause layout shifts
                disableGutters: false,
            },
        },
    }
})


export default useCreateTheme;
