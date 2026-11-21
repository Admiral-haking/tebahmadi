"use client";

import { useState } from "react";
import Link from "next/link";
import {
    Box,
    Button,
    Dialog,
    DialogContent,
    Grid,
    IconButton,
    List,
    ListItemButton,
    ListItemText,
    Stack,
    Typography,
} from "@mui/material";
import { ArrowLeft, LayoutGrid, Leaf, X } from "lucide-react";
import type { CategoryDocument } from "@/catalog/models/Category";
import { TEB_COLORS, TEB_RADII } from "@/theme/tokens";

type Props = {
    categories: CategoryDocument[];
};

export default function MegaMenu({ categories }: Props) {
    const [open, setOpen] = useState(false);

    const roots = categories.filter((x) => !x.parentId);
    const [selected, setSelected] = useState(`${roots[0]?._id || ""}`);
    const activeRoot = roots.find((r) => `${r._id}` === selected) ?? roots[0];
    const subs = categories.filter((x) => `${x.parentId}` === `${activeRoot?._id ?? ""}`);

    return (
        <>
            <Button
                variant="contained"
                color="primary"
                onClick={() => setOpen(true)}
                id="mega-btn-md"
                startIcon={<LayoutGrid size={17} strokeWidth={2} />}
                sx={{
                    minHeight: 44,
                    px: 2.25,
                    borderRadius: "9999px",
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                }}
            >
                محصولات
            </Button>

            <Dialog
                open={open}
                onClose={() => setOpen(false)}
                maxWidth="md"
                fullWidth
                slotProps={{
                    paper: {
                        sx: {
                            bgcolor: TEB_COLORS.background,
                            borderRadius: `${TEB_RADII.lg}px`,
                            border: `1px solid ${TEB_COLORS.border}`,
                            overflow: "hidden",
                        },
                    },
                }}
            >
                <Stack
                    direction="row"
                    alignItems="center"
                    justifyContent="space-between"
                    sx={{
                        px: 3,
                        py: 2,
                        bgcolor: TEB_COLORS.surface,
                        borderBottom: `1px solid ${TEB_COLORS.border}`,
                    }}
                >
                    <Stack direction="row" alignItems="center" gap={1}>
                        <Leaf size={20} color={TEB_COLORS.primary} />
                        <Typography variant="h5" fontWeight={700}>
                            دسته‌بندی محصولات طب احمدی
                        </Typography>
                    </Stack>

                    <IconButton onClick={() => setOpen(false)} aria-label="بستن منوی محصولات">
                        <X size={20} />
                    </IconButton>
                </Stack>

                <DialogContent sx={{ p: 3 }}>
                    <Grid container spacing={2.5}>
                        <Grid size={{ xs: 12, sm: 4 }}>
                            <List
                                disablePadding
                                sx={{
                                    bgcolor: TEB_COLORS.surface,
                                    borderRadius: `${TEB_RADII.md}px`,
                                    border: `1px solid ${TEB_COLORS.border}`,
                                    p: 1,
                                }}
                            >
                                {roots.map((item) => {
                                    const id = `${item._id}`;
                                    const isActive = id === `${activeRoot?._id ?? ""}`;
                                    return (
                                        <ListItemButton
                                            key={id}
                                            selected={isActive}
                                            onClick={() => setSelected(id)}
                                            sx={{
                                                borderRadius: "12px",
                                                mb: 0.5,
                                                "&.Mui-selected": {
                                                    bgcolor: TEB_COLORS.softSurface,
                                                    color: TEB_COLORS.primary,
                                                    fontWeight: 700,
                                                },
                                            }}
                                        >
                                            <ListItemText
                                                primary={item.name}
                                                primaryTypographyProps={{
                                                    fontSize: "14px",
                                                    fontWeight: isActive ? 700 : 500,
                                                }}
                                            />
                                        </ListItemButton>
                                    );
                                })}
                            </List>
                        </Grid>

                        <Grid size={{ xs: 12, sm: 8 }}>
                            <Stack
                                spacing={2}
                                sx={{
                                    height: "100%",
                                    p: 2.5,
                                    bgcolor: TEB_COLORS.surface,
                                    borderRadius: `${TEB_RADII.md}px`,
                                    border: `1px solid ${TEB_COLORS.border}`,
                                }}
                            >
                                {activeRoot && (
                                    <Stack direction="row" alignItems="center" justifyContent="space-between">
                                        <Typography variant="h6" fontWeight={700} color={TEB_COLORS.primary}>
                                            {activeRoot.name}
                                        </Typography>
                                        <Button
                                            component={Link}
                                            href={`/store/${activeRoot.path}`}
                                            onClick={() => setOpen(false)}
                                            size="small"
                                            endIcon={<ArrowLeft size={15} />}
                                        >
                                            مشاهده همه در این دسته
                                        </Button>
                                    </Stack>
                                )}

                                {subs.length > 0 ? (
                                    <Grid container spacing={1.5}>
                                        {subs.map((sub) => (
                                            <Grid key={sub.path} size={{ xs: 12, sm: 6 }}>
                                                <Box
                                                    component={Link}
                                                    href={`/store/${sub.path}`}
                                                    onClick={() => setOpen(false)}
                                                    sx={{
                                                        display: "flex",
                                                        alignItems: "center",
                                                        justifyContent: "space-between",
                                                        p: 1.5,
                                                        borderRadius: "12px",
                                                        bgcolor: TEB_COLORS.background,
                                                        border: `1px solid ${TEB_COLORS.border}`,
                                                        color: TEB_COLORS.textPrimary,
                                                        fontWeight: 600,
                                                        fontSize: "13.5px",
                                                        "&:hover": {
                                                            borderColor: TEB_COLORS.primary,
                                                            color: TEB_COLORS.primary,
                                                        },
                                                    }}
                                                >
                                                    <span>{sub.name}</span>
                                                    <ArrowLeft size={15} />
                                                </Box>
                                            </Grid>
                                        ))}
                                    </Grid>
                                ) : (
                                    <Stack spacing={1.5} justifyContent="center" sx={{ py: 2 }}>
                                        <Typography variant="body2" color="text.secondary">
                                            تمامی محصولات طبیعی و دست‌چین این دسته‌بندی آماده بررسی و سفارش آنلاین هستند.
                                        </Typography>
                                        <Box>
                                            <Button
                                                component={Link}
                                                href={activeRoot ? `/store/${activeRoot.path}` : "/store"}
                                                onClick={() => setOpen(false)}
                                                variant="contained"
                                                endIcon={<ArrowLeft size={16} />}
                                            >
                                                ورود به {activeRoot?.name ?? "فروشگاه"}
                                            </Button>
                                        </Box>
                                    </Stack>
                                )}
                            </Stack>
                        </Grid>
                    </Grid>
                </DialogContent>
            </Dialog>
        </>
    );
}