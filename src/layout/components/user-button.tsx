"use client";

import { JSX, useMemo, useState } from "react";
import Link from "next/link";
import {
    Avatar,
    Box,
    Button,
    CircularProgress,
    Divider,
    Drawer,
    IconButton,
    Stack,
    Typography,
} from "@mui/material";
import { LogOut, Package, ShieldCheck, User, X } from "lucide-react";
import { useAuth, useLoginDialog } from "@/auth";
import type { AuthUser } from "@/auth";
import ProfileForm from "./profile-form";
import { TEB_COLORS } from "@/theme/tokens";

function hasElevatedRole(user: AuthUser | null | undefined): boolean {
    if (!user?.roles?.length) {
        return false;
    }
    return user.roles.some((role) => role !== "customer");
}

function avatarSource(user: AuthUser): string | undefined {
    const thumbId = user.avatar?.thumbId;
    if (typeof thumbId !== "string") {
        return undefined;
    }

    const value = thumbId.trim();
    return value && !/^(?:undefined|null)$/i.test(value) ? `/api/media/${value}` : undefined;
}

export default function UserButton(): JSX.Element {
    const { user, status, setUser, logout } = useAuth();
    const { openLogin } = useLoginDialog();
    const [open, setOpen] = useState(false);

    const displayName = useMemo(() => {
        if (!user) return "";
        const full = `${user.fname ?? ""} ${user.lname ?? ""}`.trim();
        return full || user.phone || "حساب کاربری";
    }, [user]);

    const initials = useMemo(() => {
        if (!user) return null;
        const candidate = `${user.fname ?? ""} ${user.lname ?? ""}`.trim();
        if (candidate) return candidate.charAt(0).toUpperCase();
        return null;
    }, [user]);

    if (status === "loading" || status === "idle") {
        return (
            <Box
                sx={{
                    width: 44,
                    height: 44,
                    borderRadius: "9999px",
                    display: "grid",
                    placeItems: "center",
                    bgcolor: TEB_COLORS.softSurface,
                    border: `1px solid ${TEB_COLORS.border}`,
                }}
            >
                <CircularProgress size={18} sx={{ color: TEB_COLORS.primary }} />
            </Box>
        );
    }

    if (!user) {
        return (
            <Button
                onClick={() => openLogin()}
                variant="outlined"
                startIcon={<User size={17} strokeWidth={2} />}
                sx={{
                    minHeight: 44,
                    px: 2,
                    borderRadius: "9999px",
                    bgcolor: TEB_COLORS.softSurface,
                    borderColor: TEB_COLORS.border,
                    color: TEB_COLORS.textPrimary,
                    fontWeight: 600,
                    fontSize: "13px",
                    whiteSpace: "nowrap",
                    "&:hover": {
                        bgcolor: TEB_COLORS.surface,
                        borderColor: TEB_COLORS.primary,
                        color: TEB_COLORS.primary,
                    },
                }}
            >
                ورود / ثبت‌نام
            </Button>
        );
    }

    return (
        <>
            <Button
                onClick={() => setOpen(true)}
                variant="outlined"
                aria-label="حساب کاربری"
                startIcon={
                    <Avatar
                        alt={displayName}
                        src={avatarSource(user)}
                        sx={{
                            width: 28,
                            height: 28,
                            bgcolor: TEB_COLORS.primary,
                            color: "#FFFFFF",
                            fontSize: "12px",
                            fontWeight: 700,
                        }}
                    >
                        {initials ?? <User size={15} />}
                    </Avatar>
                }
                sx={{
                    minHeight: 44,
                    px: 1.5,
                    borderRadius: "9999px",
                    bgcolor: TEB_COLORS.softSurface,
                    borderColor: TEB_COLORS.border,
                    color: TEB_COLORS.textPrimary,
                    fontWeight: 600,
                    fontSize: "13px",
                    whiteSpace: "nowrap",
                    maxWidth: 180,
                    "&:hover": {
                        bgcolor: TEB_COLORS.surface,
                        borderColor: TEB_COLORS.primary,
                    },
                }}
            >
                <Box component="span" sx={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                    {displayName}
                </Box>
            </Button>

            <Drawer
                anchor="right"
                open={open}
                onClose={() => setOpen(false)}
                PaperProps={{
                    sx: {
                        width: { xs: "90vw", sm: 380 },
                        maxWidth: "100vw",
                        bgcolor: TEB_COLORS.background,
                    },
                }}
            >
                <Stack
                    direction="row"
                    alignItems="center"
                    justifyContent="space-between"
                    sx={{
                        px: 2.5,
                        py: 2,
                        bgcolor: TEB_COLORS.surface,
                        borderBottom: `1px solid ${TEB_COLORS.border}`,
                    }}
                >
                    <Typography variant="h6" fontWeight={700}>
                        حساب کاربری
                    </Typography>
                    <IconButton onClick={() => setOpen(false)} aria-label="بستن پنل حساب کاربری">
                        <X size={20} />
                    </IconButton>
                </Stack>

                <Box sx={{ p: 2.5, overflowY: "auto", flex: 1 }}>
                    <Stack
                        spacing={0.5}
                        sx={{
                            p: 2,
                            mb: 2.5,
                            borderRadius: "16px",
                            bgcolor: TEB_COLORS.softSurface,
                            border: `1px solid ${TEB_COLORS.border}`,
                        }}
                    >
                        <Typography variant="subtitle1" fontWeight={700}>
                            {`${user.fname ?? ""} ${user.lname ?? ""}`.trim() || "کاربر طب احمدی"}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ direction: "ltr", textAlign: "right" }}>
                            {user.phone}
                        </Typography>
                    </Stack>

                    <ProfileForm user={user} onSuccess={setUser} />

                    <Divider sx={{ my: 2.5 }} />

                    <Stack spacing={1.25} onClick={() => setOpen(false)}>
                        <Button
                            component={Link}
                            href="/orders"
                            variant="contained"
                            fullWidth
                            startIcon={<Package size={17} />}
                        >
                            سفارش‌های من
                        </Button>
                        {hasElevatedRole(user) && (
                            <Button
                                component="a"
                                href="/admin"
                                variant="outlined"
                                fullWidth
                                startIcon={<ShieldCheck size={17} />}
                            >
                                پنل مدیریت فروشگاه
                            </Button>
                        )}
                        <Button
                            onClick={() => logout()}
                            variant="text"
                            color="error"
                            fullWidth
                            startIcon={<LogOut size={17} />}
                            sx={{ color: TEB_COLORS.error }}
                        >
                            خروج از حساب کاربری
                        </Button>
                    </Stack>
                </Box>
            </Drawer>
        </>
    );
}
