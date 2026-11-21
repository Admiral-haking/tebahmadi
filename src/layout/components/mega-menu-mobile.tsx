"use client";

import { useState } from "react";
import Link from "next/link";
import {
    Box,
    Button,
    Divider,
    Drawer,
    IconButton,
    List,
    ListItemButton,
    ListItemText,
    Stack,
    Typography,
} from "@mui/material";
import {
    BookOpen,
    ChevronLeft,
    Home,
    Menu,
    Package,
    Phone,
    Store,
    User,
    X,
} from "lucide-react";
import type { CategoryDocument } from "@/catalog/models/Category";
import { useAuth, useLoginDialog } from "@/auth";
import { BRAND } from "@/config/brand";
import { TEB_COLORS } from "@/theme/tokens";

type Props = {
    categories: CategoryDocument[];
};

export default function MegaMenuMobile({ categories }: Props) {
    const [open, setOpen] = useState(false);
    const { user } = useAuth();
    const { openLogin } = useLoginDialog();

    const roots = categories.filter((x) => !x.parentId);

    const handleClose = () => setOpen(false);

    return (
        <>
            <IconButton
                onClick={() => setOpen(true)}
                id="mega-btn-xs"
                aria-label="باز کردن منوی ناوبری"
                aria-expanded={open}
                sx={{
                    width: 44,
                    height: 44,
                    borderRadius: "9999px",
                    bgcolor: TEB_COLORS.softSurface,
                    border: `1px solid ${TEB_COLORS.border}`,
                    color: TEB_COLORS.primary,
                    flexShrink: 0,
                }}
            >
                <Menu size={20} strokeWidth={2} />
            </IconButton>

            <Drawer
                anchor="right"
                open={open}
                onClose={handleClose}
                ModalProps={{ keepMounted: false }}
                PaperProps={{
                    sx: {
                        width: "86vw",
                        maxWidth: 340,
                        bgcolor: TEB_COLORS.background,
                        display: "flex",
                        flexDirection: "column",
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
                    <Typography variant="h6" fontWeight={700} color={TEB_COLORS.primary}>
                        {BRAND.name}
                    </Typography>
                    <IconButton onClick={handleClose} aria-label="بستن منو" sx={{ width: 40, height: 40 }}>
                        <X size={20} />
                    </IconButton>
                </Stack>

                <Box sx={{ flex: 1, overflowY: "auto", p: 2 }}>
                    {/* Real session summary */}
                    <Box
                        sx={{
                            p: 2,
                            mb: 2,
                            borderRadius: "16px",
                            bgcolor: TEB_COLORS.softSurface,
                            border: `1px solid ${TEB_COLORS.border}`,
                        }}
                    >
                        {user ? (
                            <Stack spacing={1}>
                                <Typography variant="subtitle2" fontWeight={700}>
                                    {`${user.fname ?? ""} ${user.lname ?? ""}`.trim() || "کاربر طب احمدی"}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ direction: "ltr", textAlign: "right" }}>
                                    {user.phone}
                                </Typography>
                                <Button
                                    component={Link}
                                    href="/orders"
                                    onClick={handleClose}
                                    variant="contained"
                                    size="small"
                                    startIcon={<Package size={15} />}
                                >
                                    پیگیری سفارش‌ها
                                </Button>
                            </Stack>
                        ) : (
                            <Stack spacing={1}>
                                <Typography variant="body2" fontWeight={600}>
                                    حساب کاربری
                                </Typography>
                                <Button
                                    onClick={() => {
                                        handleClose();
                                        openLogin();
                                    }}
                                    variant="contained"
                                    size="small"
                                    startIcon={<User size={15} />}
                                >
                                    ورود یا ثبت‌نام با شماره موبایل
                                </Button>
                            </Stack>
                        )}
                    </Box>

                    {/* Primary Navigation */}
                    <List disablePadding sx={{ mb: 2 }}>
                        {[
                            { label: "صفحه اصلی", href: "/", icon: Home },
                            { label: "همه محصولات فروشگاه", href: "/store", icon: Store },
                            { label: "مجله آموزشی طب احمدی", href: "/blog", icon: BookOpen },
                            { label: "پیگیری سفارش", href: "/orders", icon: Package },
                        ].map((item) => {
                            const Icon = item.icon;
                            return (
                                <ListItemButton
                                    key={item.href}
                                    component={Link}
                                    href={item.href}
                                    onClick={handleClose}
                                    sx={{
                                        borderRadius: "12px",
                                        minHeight: 44,
                                        gap: 1.25,
                                        mb: 0.5,
                                    }}
                                >
                                    <Icon size={18} color={TEB_COLORS.primary} />
                                    <ListItemText
                                        primary={item.label}
                                        primaryTypographyProps={{ fontSize: "14px", fontWeight: 600 }}
                                    />
                                </ListItemButton>
                            );
                        })}
                    </List>

                    <Divider sx={{ my: 1.5 }} />

                    <Typography
                        variant="caption"
                        sx={{
                            display: "block",
                            px: 1.5,
                            mb: 1,
                            color: TEB_COLORS.textSecondary,
                            fontWeight: 700,
                        }}
                    >
                        دسته‌بندی محصولات
                    </Typography>

                    <List disablePadding>
                        {roots.map((cat) => (
                            <ListItemButton
                                key={`${cat._id}`}
                                component={Link}
                                href={`/store/${cat.path}`}
                                onClick={handleClose}
                                sx={{
                                    borderRadius: "12px",
                                    minHeight: 44,
                                    justifyContent: "space-between",
                                    mb: 0.25,
                                }}
                            >
                                <ListItemText
                                    primary={cat.name}
                                    primaryTypographyProps={{ fontSize: "14px", fontWeight: 500 }}
                                />
                                <ChevronLeft size={16} color={TEB_COLORS.textSecondary} />
                            </ListItemButton>
                        ))}
                    </List>
                </Box>

                <Box
                    sx={{
                        p: 2,
                        bgcolor: TEB_COLORS.surface,
                        borderTop: `1px solid ${TEB_COLORS.border}`,
                    }}
                >
                    <Button
                        component="a"
                        href={`tel:${BRAND.phone}`}
                        fullWidth
                        variant="outlined"
                        startIcon={<Phone size={16} />}
                    >
                        پشتیبانی تلفنی: {BRAND.phone}
                    </Button>
                </Box>
            </Drawer>
        </>
    );
}