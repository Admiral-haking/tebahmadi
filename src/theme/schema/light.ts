import { ColorSystemOptions } from "@mui/material";

export const light: ColorSystemOptions = {
    palette: {
        mode: "light",
        primary: {
            main: "#111111",
            contrastText: "#FFFFFF"
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
            primary: "#232323",
            secondary: "#232323d0"
        },
        background: {
            default: "#FFFFFF",
            paper: "#FFFFFF"
        },
        divider: "#1d1c1c5b",
    }
}