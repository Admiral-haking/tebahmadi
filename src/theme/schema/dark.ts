import { ColorSystemOptions } from "@mui/material";

export const dark: ColorSystemOptions = {
    palette: {
        mode: "dark",
        primary: {
            main: "#ffffffff",
            contrastText: "#222222"
        },
        secondary: {
            main: "#7A763F",
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
            main: "#4ee967ff",
            contrastText: "#ffffff"
        },
        error: {
            main: "#f05050ff",
            contrastText: "#ffffff"
        },
        text: {
            primary: "#FFFFFF",
            secondary: "#eeeeeebe"
        },
        background: {
            default: "#121212",
            paper: "#111111"
        },
        divider: "#ffffff1f",
    }
}