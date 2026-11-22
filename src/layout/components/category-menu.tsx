"use client";

import { CategoryDocument } from "../../catalog/models/Category";
import { Box, Divider, List, ListItemButton, ListItemText, Stack, Typography } from "@mui/material";
import ChevronLeftRoundedIcon from "@mui/icons-material/ChevronLeftRounded";
import SpaOutlinedIcon from "@mui/icons-material/SpaOutlined";
import Link from "next/link";
import { brandTokens } from "../../theme/design-system";

export type CategoryMenuChild = {
  id: string;
  label: string;
  href: string;
};

export type CategoryMenuItem = CategoryMenuChild & {
  children: CategoryMenuChild[];
};

function asId(value: unknown): string {
  return value == null ? "" : String(value);
}

function categoryHref(path: unknown): string {
  const normalized = String(path ?? "").trim();
  return normalized ? `/store/${normalized}` : "/store";
}

export function buildCategoryMenuItems(categories: CategoryDocument[]): CategoryMenuItem[] {
  const roots = categories.filter((category) => category.parentId == null);

  return roots.map((root) => ({
    id: asId(root._id),
    label: root.name,
    href: categoryHref(root.path),
    children: categories
      .filter((category) => asId(category.parentId) === asId(root._id))
      .map((child) => ({
        id: asId(child._id),
        label: child.name,
        href: categoryHref(child.path),
      })),
  }));
}

export function CategoryMenuList({ items, onNavigate }: { items: CategoryMenuItem[]; onNavigate: () => void }) {
  if (items.length === 0) {
    return (
      <Stack alignItems="center" textAlign="center" gap={1} sx={{ px: 2, py: 4, color: "text.secondary" }}>
        <Box sx={{ width: 42, height: 42, display: "grid", placeItems: "center", borderRadius: "50%", bgcolor: brandTokens.color.primarySoft, color: "primary.main" }}>
          <SpaOutlinedIcon sx={{ fontSize: 21 }} />
        </Box>
        <Typography sx={{ fontSize: 13, fontWeight: 700, color: "text.primary" }}>دسته‌بندی‌ای برای نمایش وجود ندارد</Typography>
        <Typography sx={{ fontSize: 11.5 }}>دسته‌بندی‌ها پس از ثبت در پنل مدیریت اینجا نمایش داده می‌شوند.</Typography>
      </Stack>
    );
  }

  return (
    <List disablePadding sx={{ display: "grid", gap: 0.5 }}>
      {items.map((item) => (
        <Box key={item.id}>
          <ListItemButton
            component={Link}
            href={item.href}
            onClick={onNavigate}
            sx={{
              minHeight: 48,
              borderRadius: 2.5,
              px: 1.25,
              gap: 1,
              color: "text.primary",
              "&:hover": { bgcolor: brandTokens.color.primarySoft, color: brandTokens.color.primaryDeep },
            }}
          >
            <Box sx={{ display: "grid", placeItems: "center", width: 30, height: 30, borderRadius: "50%", bgcolor: brandTokens.color.primarySoft, color: "primary.main", flexShrink: 0 }}>
              <SpaOutlinedIcon sx={{ fontSize: 17 }} />
            </Box>
            <ListItemText primary={item.label} primaryTypographyProps={{ fontSize: 14, fontWeight: 600 }} />
            <ChevronLeftRoundedIcon sx={{ fontSize: 18, color: "text.secondary" }} />
          </ListItemButton>
          {item.children.length > 0 ? (
            <Stack sx={{ pr: 6, pb: 0.5 }}>
              {item.children.map((child) => (
                <ListItemButton
                  key={child.id}
                  component={Link}
                  href={child.href}
                  onClick={onNavigate}
                  sx={{ minHeight: 32, borderRadius: 1.5, px: 1, py: 0.25, color: "text.secondary", "&:hover": { bgcolor: brandTokens.color.primarySoft, color: brandTokens.color.primaryDeep } }}
                >
                  <ListItemText primary={child.label} primaryTypographyProps={{ fontSize: 12.5 }} />
                </ListItemButton>
              ))}
            </Stack>
          ) : null}
        </Box>
      ))}
    </List>
  );
}

export function CategoryMenuHeader({ mobile = false }: { mobile?: boolean }) {
  return (
    <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2} sx={{ px: mobile ? 0 : 1, py: mobile ? 0 : 0.5 }}>
      <Box>
        <Typography component="h2" sx={{ fontSize: mobile ? 19 : 16, fontWeight: 800, color: brandTokens.color.primaryDeep }}>محصولات</Typography>
        <Typography sx={{ mt: 0.35, fontSize: 11.5, color: "text.secondary" }}>دسته‌بندی‌های طب احمدی</Typography>
      </Box>
      <Box sx={{ width: 34, height: 34, display: "grid", placeItems: "center", borderRadius: "50%", bgcolor: brandTokens.color.primarySoft, color: "primary.main" }}>
        <SpaOutlinedIcon sx={{ fontSize: 18 }} />
      </Box>
    </Stack>
  );
}

export function CategoryMenuDivider() {
  return <Divider sx={{ my: 1.25, borderColor: "divider" }} />;
}
