"use client";

import {
  Alert,
  Button,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  TextField,
} from "@mui/material";
import {
  CodeRounded,
  CreditCardRounded,
  ErrorOutlineRounded,
  ExpandLessRounded,
  ExpandMoreRounded,
  LockRounded,
  LogoutRounded,
} from "@mui/icons-material";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { DEVELOPER_MENU_ITEMS } from "./developer-menu-data";

const developerIcons = [CreditCardRounded, CreditCardRounded, ErrorOutlineRounded] as const;

export default function DeveloperMenu() {
  const pathname = usePathname();
  const [authorized, setAuthorized] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    void fetch("/api/admin/developer-access", { credentials: "include", cache: "no-store" })
      .then((response) => (response.ok ? response.json() : { authorized: false }))
      .then((data: { authorized?: boolean }) => {
        if (!active) return;
        const isAuthorized = data.authorized === true;
        setAuthorized(isAuthorized);
        setExpanded(isAuthorized && DEVELOPER_MENU_ITEMS.some((item) => pathname.startsWith(item.href)));
      })
      .catch(() => {
        if (active) setAuthorized(false);
      });

    return () => {
      active = false;
    };
  }, [pathname]);

  const openDeveloperMenu = () => {
    if (authorized) {
      setExpanded((current) => !current);
      return;
    }
    setError(null);
    setDialogOpen(true);
  };

  const unlock = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/developer-access", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (!response.ok) {
        throw new Error("رمز توسعه‌دهنده صحیح نیست یا دسترسی روی سرور تنظیم نشده است.");
      }

      setAuthorized(true);
      setExpanded(true);
      setDialogOpen(false);
      setPassword("");
    } catch (unlockError) {
      setError(unlockError instanceof Error ? unlockError.message : "باز کردن دسترسی ناموفق بود.");
    } finally {
      setSubmitting(false);
    }
  };

  const lock = async () => {
    await fetch("/api/admin/developer-access", {
      method: "DELETE",
      credentials: "include",
    }).catch(() => undefined);
    setAuthorized(false);
    setExpanded(false);
  };

  return (
    <>
      <ListItem disablePadding sx={{ mt: 1 }}>
        <ListItemButton
          onClick={openDeveloperMenu}
          aria-label="باز کردن ابزارهای توسعه‌دهنده"
          aria-expanded={authorized && expanded}
          sx={{
            minHeight: 46,
            borderRadius: 1.5,
            px: 1.5,
            borderTop: "1px solid",
            borderColor: "divider",
            pt: 1.5,
            "&:hover": { bgcolor: "rgba(42, 90, 68, .06)" },
          }}
        >
          <ListItemIcon sx={{ color: "inherit", minWidth: 36 }}>
            {authorized ? <CodeRounded /> : <LockRounded />}
          </ListItemIcon>
          <ListItemText
            primary="توسعه‌دهنده"
            secondary={authorized ? "ابزارهای حساس" : "نیازمند رمز"}
            primaryTypographyProps={{ fontSize: 13.5, fontWeight: 700 }}
            secondaryTypographyProps={{ fontSize: 11 }}
          />
          {authorized ? (expanded ? <ExpandLessRounded /> : <ExpandMoreRounded />) : null}
        </ListItemButton>
      </ListItem>

      <Collapse in={authorized && expanded} timeout="auto" unmountOnExit>
        <List component="div" disablePadding sx={{ pr: 1.5, pl: 0.5 }}>
          {DEVELOPER_MENU_ITEMS.map((item, index) => {
            const Icon = developerIcons[index];
            return (
              <ListItem key={item.href} disablePadding>
                <ListItemButton
                  LinkComponent={Link}
                  href={item.href}
                  aria-label={item.title}
                  selected={pathname === item.href || pathname.startsWith(`${item.href}/`)}
                  sx={{
                    minHeight: 42,
                    borderRadius: 1.5,
                    px: 1.25,
                    "&.Mui-selected": {
                      bgcolor: "rgba(42, 90, 68, .1)",
                      color: "primary.main",
                    },
                  }}
                >
                  <ListItemIcon sx={{ color: "inherit", minWidth: 34 }}>
                    <Icon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText primary={item.title} primaryTypographyProps={{ fontSize: 12.5, fontWeight: 600 }} />
                </ListItemButton>
              </ListItem>
            );
          })}
          <ListItem disablePadding>
            <ListItemButton onClick={() => void lock()} sx={{ minHeight: 40, borderRadius: 1.5, px: 1.25 }}>
              <ListItemIcon sx={{ minWidth: 34 }}>
                <LogoutRounded fontSize="small" />
              </ListItemIcon>
              <ListItemText primary="قفل کردن ابزارها" primaryTypographyProps={{ fontSize: 12.5, fontWeight: 600 }} />
            </ListItemButton>
          </ListItem>
        </List>
      </Collapse>

      <Dialog open={dialogOpen} onClose={() => !submitting && setDialogOpen(false)} fullWidth maxWidth="xs" dir="rtl">
        <DialogTitle>ورود به بخش توسعه‌دهنده</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            این بخش فقط برای مدیران مجاز است و در منوی اصلی نمایش داده نمی‌شود.
          </Alert>
          <TextField
            autoFocus
            fullWidth
            type="password"
            label="رمز توسعه‌دهنده"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && password && !submitting) void unlock();
            }}
            error={Boolean(error)}
            helperText={error ?? "رمز در تنظیمات امن سرور بررسی می‌شود."}
            inputProps={{ maxLength: 128, inputMode: "numeric" }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)} disabled={submitting}>انصراف</Button>
          <Button onClick={() => void unlock()} variant="contained" disabled={!password || submitting}>
            {submitting ? "در حال بررسی…" : "باز کردن"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
