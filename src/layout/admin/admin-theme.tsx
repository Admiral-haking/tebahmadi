"use client";

import { useMemo, type ReactNode } from "react";
import { ThemeProvider, createTheme, useTheme } from "@mui/material/styles";

/**
 * Scoped visual polish for the admin panel only.
 *
 * It extends the app's existing theme (inheriting palette, RTL, fonts) and adds
 * gentle, consistent component defaults — softer card shadows, smoother button
 * hovers, rounded chips — so every admin page looks tidy without touching the
 * global theme (the customer-facing storefront is unaffected).
 */
export default function AdminTheme({ children }: { children: ReactNode }) {
    const parent = useTheme();

    const theme = useMemo(
        () =>
            createTheme(parent, {
                components: {
                    MuiPaper: {
                        styleOverrides: {
                            // Only outlined/elevation-0 cards get the soft shadow; menus/popovers keep MUI defaults.
                            root: {
                                "&.MuiPaper-elevation0": {
                                    boxShadow: "0 1px 2px rgba(var(--mui-palette-common-onBackgroundChannel) / 0.04), 0 4px 14px rgba(var(--mui-palette-common-onBackgroundChannel) / 0.05)",
                                },
                            },
                        },
                    },
                    MuiCard: {
                        defaultProps: { elevation: 0 },
                        styleOverrides: {
                            root: {
                                borderRadius: 12,
                                boxShadow: "0 1px 2px rgba(var(--mui-palette-common-onBackgroundChannel) / 0.04), 0 6px 18px rgba(var(--mui-palette-common-onBackgroundChannel) / 0.06)",
                            },
                        },
                    },
                    MuiButton: {
                        defaultProps: { disableElevation: true },
                        styleOverrides: {
                            root: {
                                borderRadius: 10,
                                textTransform: "none",
                                fontWeight: 600,
                                transition: "transform 0.15s ease, box-shadow 0.15s ease, background-color 0.15s ease",
                            },
                            containedPrimary: {
                                "&:hover": { transform: "translateY(-1px)" },
                            },
                        },
                    },
                    MuiChip: {
                        styleOverrides: {
                            root: { borderRadius: 8, fontWeight: 500 },
                        },
                    },
                    MuiTableHead: {
                        styleOverrides: {
                            root: { "& th": { fontWeight: 700 } },
                        },
                    },
                },
            }),
        [parent],
    );

    return <ThemeProvider theme={theme}>{children}</ThemeProvider>;
}
