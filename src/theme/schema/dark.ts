import { ColorSystemOptions } from "@mui/material";
import { TEB_COLORS } from "../tokens";

export const dark: ColorSystemOptions = {
    palette: {
        mode: "dark",
        primary: {
            main: "#4E8D6F",
            dark: TEB_COLORS.primary,
            light: "#69A98B",
            contrastText: "#FFFFFF",
        },
        secondary: {
            main: "#262C27",
            contrastText: "#F4F3E5",
        },
        info: {
            main: TEB_COLORS.gold,
            contrastText: "#1A1D1A",
        },
        warning: {
            main: TEB_COLORS.gold,
            contrastText: "#1A1D1A",
        },
        success: {
            main: "#4E8D6F",
            contrastText: "#FFFFFF",
        },
        error: {
            main: "#C96A6C",
            contrastText: "#FFFFFF",
        },
        text: {
            primary: "#F4F3E5",
            secondary: "#C6C8BC",
            disabled: "#7F847B",
        },
        background: {
            default: "#161B18",
            paper: "#1E2420",
        },
        divider: "#303831",
    },
};