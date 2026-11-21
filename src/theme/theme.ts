"use client"

import { createTheme, SupportedColorScheme } from "@mui/material"
import colorSchemes from "./schema";
import localFont from "next/font/local";
import { brandTokens } from "./design-system";

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
        borderRadius: brandTokens.radius.control
    },
    typography: {
        fontFamily: defaultFont.style.fontFamily,
        fontSize: brandTokens.typography.sm,
        h1: { fontWeight: 700, fontSize: "clamp(2rem, 5vw, 3.25rem)", lineHeight: 1.25 },
        h2: { fontWeight: 700, fontSize: "clamp(1.65rem, 4vw, 2.5rem)", lineHeight: 1.3 },
        h3: { fontWeight: 700, fontSize: "clamp(1.35rem, 3vw, 2rem)", lineHeight: 1.35 },
        h4: { fontWeight: 700, fontSize: "clamp(1.2rem, 2.5vw, 1.65rem)", lineHeight: 1.4 },
        button: { fontWeight: 600, textTransform: "none" },
    },
    components: {
        MuiCssBaseline: {
            styleOverrides: () => ({
                body: {
                    WebkitFontSmoothing: 'antialiased',
                    MozOsxFontSmoothing: 'grayscale',
                    margin: 0,
                    padding: 0,
                    overflowX: "hidden",
                    backgroundImage: "radial-gradient(circle at 85% -10%, rgba(109, 125, 69, .07), transparent 30rem)",
                    minHeight: "100vh",
                },
                a: {
                    color: "var(--mui-palette-primary-main)",
                    textDecoration: 'none',
                },
                "::selection": { backgroundColor: "rgba(42, 90, 68, .18)" },
                "*:focus-visible": {
                    outline: `3px solid ${brandTokens.color.accent}`,
                    outlineOffset: 3,
                },
                "*": { boxSizing: "border-box", scrollbarWidth: "thin", scrollbarColor: `${brandTokens.color.primary} transparent` },
                "*::-webkit-scrollbar": { width: "6px" },
                "*::-webkit-scrollbar-track": { background: "transparent" },
                "*::-webkit-scrollbar-thumb": {
                    backgroundColor: brandTokens.color.primary,
                    borderRadius: "6px",
                    border: "1px solid transparent"
                },
                // Improve image rendering to prevent CLS
                "img, video": {
                    maxWidth: "100%",
                    height: "auto",
                },
                "iframe": {
                    maxWidth: "100%",
                },
                "@media (prefers-reduced-motion: reduce)": {
                    "*, *::before, *::after": {
                        scrollBehavior: "auto !important",
                        animationDuration: "0.01ms !important",
                        animationIterationCount: "1 !important",
                        transitionDuration: "0.01ms !important",
                    },
                },
            }),
        },
        MuiContainer: {
            defaultProps: {
                // Ensure containers don't cause layout shifts
                disableGutters: false,
            },
        },
        MuiButton: {
            defaultProps: { disableElevation: true },
            styleOverrides: {
                root: {
                    minHeight: 44,
                    borderRadius: brandTokens.radius.pill,
                    paddingInline: brandTokens.space(5),
                    textTransform: "none",
                    fontWeight: 600,
                },
                contained: { boxShadow: "none" },
            },
        },
        MuiIconButton: {
            styleOverrides: { root: { minWidth: 44, minHeight: 44 } },
        },
        MuiPaper: {
            styleOverrides: {
                root: { backgroundImage: "none" },
                rounded: { borderRadius: brandTokens.radius.card },
            },
        },
        MuiCard: {
            defaultProps: { elevation: 0 },
            styleOverrides: {
                root: {
                    borderRadius: brandTokens.radius.card,
                    border: `1px solid ${brandTokens.color.border}`,
                    boxShadow: brandTokens.shadow.subtle,
                },
            },
        },
        MuiTextField: {
            defaultProps: { variant: "outlined" },
        },
        MuiOutlinedInput: {
            styleOverrides: {
                root: {
                    minHeight: 52,
                    borderRadius: brandTokens.radius.control,
                    backgroundColor: "var(--mui-palette-background-paper)",
                    "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: brandTokens.color.primary },
                    "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderWidth: 1.5 },
                },
            },
        },
        MuiChip: {
            styleOverrides: { root: { borderRadius: brandTokens.radius.pill, fontWeight: 600 } },
        },
        MuiDialog: {
            styleOverrides: { paper: { margin: 16, maxWidth: "calc(100% - 32px)" } },
        },
    }
})


export default useCreateTheme;
