"use client";

import { useMemo, type ReactNode } from "react";
import { ThemeProvider, createTheme, useTheme } from "@mui/material/styles";
import { TEB_COLORS, TEB_RADII } from "@/theme/tokens";

export default function AdminTheme({ children }: { children: ReactNode }) {
    const parent = useTheme();

    const theme = useMemo(
        () =>
            createTheme(parent, {
                components: {
                    MuiPaper: {
                        styleOverrides: {
                            root: {
                                "&.MuiPaper-elevation0": {
                                    borderColor: TEB_COLORS.border,
                                },
                            },
                        },
                    },
                    MuiCard: {
                        defaultProps: { elevation: 0 },
                        styleOverrides: {
                            root: {
                                borderRadius: TEB_RADII.lg,
                                border: `1px solid ${TEB_COLORS.border}`,
                                backgroundColor: TEB_COLORS.surface,
                                boxShadow: "0 2px 10px rgba(34, 34, 34, 0.03)",
                            },
                        },
                    },
                    MuiButton: {
                        defaultProps: { disableElevation: true },
                        styleOverrides: {
                            root: {
                                borderRadius: TEB_RADII.md,
                                minHeight: 40,
                                textTransform: "none",
                                fontWeight: 600,
                            },
                        },
                    },
                    MuiChip: {
                        styleOverrides: {
                            root: {
                                borderRadius: TEB_RADII.pill,
                                fontWeight: 600,
                            },
                        },
                    },
                    MuiTableHead: {
                        styleOverrides: {
                            root: {
                                "& th": {
                                    fontWeight: 700,
                                    backgroundColor: TEB_COLORS.softSurface,
                                    color: TEB_COLORS.textPrimary,
                                },
                            },
                        },
                    },
                },
            }),
        [parent],
    );

    return <ThemeProvider theme={theme}>{children}</ThemeProvider>;
}
