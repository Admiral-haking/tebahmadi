"use client";

import Link from "next/link";
import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Box,
    Grid,
    Stack,
    Typography,
} from "@mui/material";
import { ChevronDown } from "lucide-react";
import { TEB_COLORS } from "@/theme/tokens";

export type FooterLinkGroup = {
    id: string;
    title: string;
    links: Array<{ label: string; href: string }>;
};

export function FooterColumns({ groups }: { groups: FooterLinkGroup[] }) {
    return (
        <>
            {/* Desktop columns */}
            <Grid container spacing={3} sx={{ display: { xs: "none", md: "flex" } }}>
                {groups.map((group) => (
                    <Grid key={group.id} size={{ md: 4 }}>
                        <Typography
                            variant="subtitle2"
                            sx={{
                                fontWeight: 700,
                                fontSize: "14px",
                                color: TEB_COLORS.primaryDark,
                                mb: 1.5,
                            }}
                        >
                            {group.title}
                        </Typography>
                        <Stack spacing={1}>
                            {group.links.map((link) => (
                                <Box
                                    key={link.href + link.label}
                                    component={Link}
                                    href={link.href}
                                    sx={{
                                        fontSize: "13px",
                                        color: TEB_COLORS.textSecondary,
                                        textDecoration: "none",
                                        transition: "color 0.18s ease",
                                        "&:hover": {
                                            color: TEB_COLORS.primary,
                                        },
                                    }}
                                >
                                    {link.label}
                                </Box>
                            ))}
                        </Stack>
                    </Grid>
                ))}
            </Grid>

            {/* Mobile collapsible accordions */}
            <Box sx={{ display: { xs: "block", md: "none" } }}>
                {groups.map((group) => (
                    <Accordion
                        key={group.id}
                        disableGutters
                        elevation={0}
                        sx={{
                            bgcolor: "transparent",
                            borderBottom: `1px solid ${TEB_COLORS.border}`,
                            "&::before": { display: "none" },
                        }}
                    >
                        <AccordionSummary
                            expandIcon={<ChevronDown size={18} color={TEB_COLORS.primary} />}
                            sx={{ px: 0, minHeight: 48 }}
                        >
                            <Typography variant="subtitle2" fontWeight={700} color={TEB_COLORS.primaryDark}>
                                {group.title}
                            </Typography>
                        </AccordionSummary>
                        <AccordionDetails sx={{ px: 0, pt: 0, pb: 1.5 }}>
                            <Stack spacing={1.25}>
                                {group.links.map((link) => (
                                    <Box
                                        key={link.href + link.label}
                                        component={Link}
                                        href={link.href}
                                        sx={{
                                            fontSize: "13.5px",
                                            color: TEB_COLORS.textSecondary,
                                            py: 0.25,
                                        }}
                                    >
                                        {link.label}
                                    </Box>
                                ))}
                            </Stack>
                        </AccordionDetails>
                    </Accordion>
                ))}
            </Box>
        </>
    );
}
