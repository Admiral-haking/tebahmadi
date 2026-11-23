import { ColorSystemOptions } from "@mui/material";
import { TEB_COLORS } from "../tokens";

export const light: ColorSystemOptions = {
    palette: {
        mode: "light",
        primary: {
            main: TEB_COLORS.primary,
            dark: TEB_COLORS.primaryDark,
            light: TEB_COLORS.primaryLight,
            contrastText: "#FFFFFF",
        },
        secondary: {
            main: TEB_COLORS.softSurface,
            dark: "#E7E5D1",
            light: "#FAF9F1",
            contrastText: TEB_COLORS.textPrimary,
        },
        info: {
            main: TEB_COLORS.gold,
            contrastText: "#FFFFFF",
        },
        warning: {
            main: TEB_COLORS.gold,
            dark: TEB_COLORS.warning,
            contrastText: TEB_COLORS.textPrimary,
        },
        success: {
            main: TEB_COLORS.primary,
            dark: TEB_COLORS.primaryDark,
            contrastText: "#FFFFFF",
        },
        error: {
            main: TEB_COLORS.error,
            light: TEB_COLORS.errorSoft,
            contrastText: "#FFFFFF",
        },
        text: {
            primary: TEB_COLORS.textPrimary,
            secondary: TEB_COLORS.textSecondary,
            disabled: "#8E9289",
        },
        background: {
            default: TEB_COLORS.background,
            paper: TEB_COLORS.surface,
        },
        divider: TEB_COLORS.border,
        grey: {
            50: "#F9F8F6",
            100: "#F4F3E5",
            200: "#E8E8DA",
            300: "#DEE0D0",
            400: "#B9BDAE",
            500: "#8E9289",
            600: "#636860",
            700: "#424640",
            800: "#2C2F2B",
            900: "#222222",
        },
    },
};