"use client";
import { AppRouterCacheProvider } from '@mui/material-nextjs/v15-appRouter';
import { RTL } from './core/right-to-left';
import { CssBaseline, InitColorSchemeScript, SupportedColorScheme, ThemeProvider } from '@mui/material';
import useCreateTheme from './theme';

export { defaultFont } from "./theme"

function getMode(): SupportedColorScheme {
    if (typeof window === 'undefined') return "light";
    return localStorage.getItem("mui-mode") as SupportedColorScheme
}

export default function AppTheme({ children, defaultMode = 'light' }: ChildrenProps<{ defaultMode?: 'light' | 'dark' }>) {

    const theme = useCreateTheme(getMode())

    return <AppRouterCacheProvider options={{ enableCssLayer: true }} >
        <ThemeProvider theme={theme} defaultMode={defaultMode} >
            <InitColorSchemeScript defaultMode={defaultMode} attribute='class' />
            <CssBaseline enableColorScheme />
            <RTL>{children}</RTL>
        </ThemeProvider>
    </AppRouterCacheProvider>
}