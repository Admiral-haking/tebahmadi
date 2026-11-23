"use client";

import { useMemo } from "react";
import { RTL } from "./core/right-to-left";
import { CssBaseline, InitColorSchemeScript, ThemeProvider } from "@mui/material";
import useCreateTheme from "./theme";

export { defaultFont, TEB_COLORS, TEB_RADII, TEB_FONT_SIZES, TEB_SPACING_BASE } from "./theme";

export default function AppTheme({
    children,
    defaultMode = "light",
}: ChildrenProps<{ defaultMode?: "light" | "dark" }>) {
    const theme = useMemo(() => useCreateTheme(defaultMode), [defaultMode]);

    return (
        <ThemeProvider theme={theme} defaultMode={defaultMode}>
            <InitColorSchemeScript defaultMode={defaultMode} attribute="class" />
            <CssBaseline enableColorScheme />
            <RTL>{children}</RTL>
        </ThemeProvider>
    );
}