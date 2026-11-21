import { ColorSystemOptions } from "@mui/material";
import { brandTokens } from "../design-system";

export const dark: ColorSystemOptions = {
    palette: {
        mode: "dark",
        primary: {
            main: "#9DC1A7",
            contrastText: "#10271D"
        },
        secondary: {
            main: brandTokens.color.accent,
            contrastText: "#FFFFFF"
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
            main: "#71B78B",
            contrastText: "#ffffff"
        },
        error: {
            main: "#D87A7C",
            contrastText: "#ffffff"
        },
        text: {
            primary: "#FFFFFF",
            secondary: "#eeeeeebe"
        },
        background: {
            default: "#101813",
            paper: "#17231C"
        },
        divider: "#DCE8E033",
    }
}
