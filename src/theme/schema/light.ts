import { ColorSystemOptions } from "@mui/material";
import { brandTokens } from "../design-system";

export const light: ColorSystemOptions = {
    palette: {
        mode: "light",
        primary: {
            main: brandTokens.color.primary,
            contrastText: "#FFFFFF"
        },
        secondary: {
            main: brandTokens.color.accent,
            contrastText: brandTokens.color.primaryDeep
        },
        info: {
            main: "#5da8e6ff",
            contrastText: "#111111"
        },
        warning: {
            main: "#e6c15dff",
            contrastText: "#111111"
        },
        success: {
            main: brandTokens.color.success,
            contrastText: "#ffffff"
        },
        error: {
            main: brandTokens.color.danger,
            contrastText: "#ffffff"
        },
        text: {
            primary: brandTokens.color.text,
            secondary: brandTokens.color.textMuted
        },
        background: {
            default: brandTokens.color.canvas,
            paper: brandTokens.color.surface
        },
        divider: brandTokens.color.border,
    }
}
