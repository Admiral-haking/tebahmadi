"use client";

import { createTheme, SupportedColorScheme } from "@mui/material";
import colorSchemes from "./schema";
import localFont from "next/font/local";
import { TEB_COLORS, TEB_FONT_SIZES, TEB_RADII, TEB_SPACING_BASE } from "./tokens";

export { TEB_COLORS, TEB_FONT_SIZES, TEB_RADII, TEB_SPACING_BASE } from "./tokens";

export const defaultFont = localFont({
    variable: "--font-default",
    display: "swap",
    src: [
        { path: "../../public/fonts/Peyda-Regular.woff2", weight: "400", style: "normal" },
        { path: "../../public/fonts/Peyda-Medium.woff2", weight: "500", style: "normal" },
        { path: "../../public/fonts/Peyda-SemiBold.woff2", weight: "600", style: "normal" },
        { path: "../../public/fonts/Peyda-Bold.woff2", weight: "700", style: "normal" },
    ],
    preload: true,
    fallback: ["tahoma", "helvetica", "arial", "sans-serif"],
});

const useCreateTheme = (defaultColorScheme: SupportedColorScheme = "light") =>
    createTheme({
        cssVariables: {
            colorSchemeSelector: "class",
        },
        direction: "rtl",
        spacing: TEB_SPACING_BASE,
        colorSchemes,
        defaultColorScheme,
        shape: {
            borderRadius: TEB_RADII.md,
        },
        typography: {
            fontFamily: defaultFont.style.fontFamily,
            h1: {
                fontSize: `${TEB_FONT_SIZES["4xl"]}px`,
                fontWeight: 700,
                lineHeight: 1.25,
                letterSpacing: "-0.01em",
            },
            h2: {
                fontSize: `${TEB_FONT_SIZES["3xl"]}px`,
                fontWeight: 700,
                lineHeight: 1.3,
            },
            h3: {
                fontSize: `${TEB_FONT_SIZES["2xl"]}px`,
                fontWeight: 700,
                lineHeight: 1.35,
            },
            h4: {
                fontSize: `${TEB_FONT_SIZES.xl}px`,
                fontWeight: 700,
                lineHeight: 1.4,
            },
            h5: {
                fontSize: `${TEB_FONT_SIZES.lg}px`,
                fontWeight: 600,
                lineHeight: 1.45,
            },
            h6: {
                fontSize: `${TEB_FONT_SIZES.base}px`,
                fontWeight: 600,
                lineHeight: 1.5,
            },
            body1: {
                fontSize: `${TEB_FONT_SIZES.base}px`,
                lineHeight: 1.7,
            },
            body2: {
                fontSize: `${TEB_FONT_SIZES.sm}px`,
                lineHeight: 1.65,
            },
            caption: {
                fontSize: `${TEB_FONT_SIZES.xs}px`,
                lineHeight: 1.5,
            },
            button: {
                fontSize: `${TEB_FONT_SIZES.sm}px`,
                fontWeight: 600,
                textTransform: "none",
            },
        },
        components: {
            MuiCssBaseline: {
                styleOverrides: () => ({
                    html: {
                        overflowX: "clip",
                        backgroundColor: TEB_COLORS.background,
                    },
                    body: {
                        WebkitFontSmoothing: "antialiased",
                        MozOsxFontSmoothing: "grayscale",
                        margin: 0,
                        padding: 0,
                        backgroundColor: TEB_COLORS.background,
                        color: TEB_COLORS.textPrimary,
                        overflowX: "clip",
                        fontFeatureSettings: '"tnum" on',
                    },
                    a: {
                        color: "inherit",
                        textDecoration: "none",
                    },
                    ":focus-visible": {
                        outline: `2px solid ${TEB_COLORS.primary}`,
                        outlineOffset: "2px",
                    },
                    "@media (prefers-reduced-motion: reduce)": {
                        "*, *::before, *::after": {
                            animationDuration: "0.01ms !important",
                            animationIterationCount: "1 !important",
                            transitionDuration: "0.01ms !important",
                            scrollBehavior: "auto !important",
                        },
                    },
                    "*": {
                        scrollbarWidth: "thin",
                        scrollbarColor: `${TEB_COLORS.border} ${TEB_COLORS.background}`,
                    },
                    "*::-webkit-scrollbar": { width: "6px", height: "6px" },
                    "*::-webkit-scrollbar-track": { background: TEB_COLORS.background },
                    "*::-webkit-scrollbar-thumb": {
                        backgroundColor: TEB_COLORS.border,
                        borderRadius: "9999px",
                    },
                    "img, video": {
                        maxWidth: "100%",
                        height: "auto",
                    },
                    iframe: {
                        maxWidth: "100%",
                    },
                }),
            },
            MuiContainer: {
                defaultProps: {
                    disableGutters: false,
                },
            },
            MuiButton: {
                defaultProps: {
                    disableElevation: true,
                },
                styleOverrides: {
                    root: {
                        borderRadius: TEB_RADII.pill,
                        minHeight: 44,
                        paddingInline: 20,
                        fontWeight: 600,
                        textTransform: "none",
                        transition: "background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease, transform 0.15s ease",
                    },
                    sizeSmall: {
                        minHeight: 38,
                        paddingInline: 14,
                        fontSize: `${TEB_FONT_SIZES.xs}px`,
                    },
                    sizeLarge: {
                        minHeight: 48,
                        paddingInline: 28,
                        fontSize: `${TEB_FONT_SIZES.base}px`,
                    },
                    containedPrimary: {
                        backgroundColor: TEB_COLORS.primary,
                        color: "#FFFFFF",
                        "&:hover": {
                            backgroundColor: TEB_COLORS.primaryDark,
                        },
                    },
                    outlinedPrimary: {
                        borderColor: TEB_COLORS.border,
                        color: TEB_COLORS.primary,
                        "&:hover": {
                            borderColor: TEB_COLORS.primary,
                            backgroundColor: TEB_COLORS.softSurface,
                        },
                    },
                },
            },
            MuiCard: {
                defaultProps: {
                    elevation: 0,
                },
                styleOverrides: {
                    root: {
                        borderRadius: TEB_RADII.lg,
                        border: `1px solid ${TEB_COLORS.border}`,
                        backgroundColor: TEB_COLORS.surface,
                        boxShadow: "none",
                    },
                },
            },
            MuiPaper: {
                styleOverrides: {
                    outlined: {
                        borderColor: TEB_COLORS.border,
                    },
                },
            },
            MuiOutlinedInput: {
                styleOverrides: {
                    root: {
                        borderRadius: TEB_RADII.md,
                        backgroundColor: TEB_COLORS.surface,
                        "& .MuiOutlinedInput-notchedOutline": {
                            borderColor: TEB_COLORS.border,
                        },
                        "&:hover .MuiOutlinedInput-notchedOutline": {
                            borderColor: TEB_COLORS.primary,
                        },
                        "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                            borderColor: TEB_COLORS.primary,
                            borderWidth: "1.5px",
                        },
                    },
                },
            },
            MuiChip: {
                styleOverrides: {
                    root: {
                        borderRadius: TEB_RADII.pill,
                        fontWeight: 500,
                    },
                },
            },
            MuiDrawer: {
                styleOverrides: {
                    paper: {
                        backgroundColor: TEB_COLORS.background,
                        borderColor: TEB_COLORS.border,
                    },
                },
            },
            MuiDialog: {
                styleOverrides: {
                    paper: {
                        borderRadius: TEB_RADII.lg,
                        border: `1px solid ${TEB_COLORS.border}`,
                    },
                },
            },
            MuiDivider: {
                styleOverrides: {
                    root: {
                        borderColor: TEB_COLORS.border,
                    },
                },
            },
            MuiTableHead: {
                styleOverrides: {
                    root: {
                        "& th": {
                            backgroundColor: TEB_COLORS.softSurface,
                            color: TEB_COLORS.textPrimary,
                            fontWeight: 700,
                            borderBottomColor: TEB_COLORS.border,
                        },
                    },
                },
            },
        },
    });

export default useCreateTheme;
