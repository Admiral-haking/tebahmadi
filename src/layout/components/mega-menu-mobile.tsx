"use client";

import { CategoryDocument } from "@/catalog/models/Category";
import { Box, Divider, Drawer, IconButton, Stack } from "@mui/material";
import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import { useMemo, useState } from "react";
import { brandTokens } from "@/theme/design-system";
import { buildCategoryMenuItems, CategoryMenuDivider, CategoryMenuHeader, CategoryMenuList } from "./category-menu";

type Props = {
  categories: CategoryDocument[];
};

export default function MegaMenuMobile({ categories }: Props) {
  const [open, setOpen] = useState(false);
  const items = useMemo(() => buildCategoryMenuItems(categories), [categories]);

  return (
    <>
      <IconButton
        id="mega-btn-xs"
        onClick={() => setOpen(true)}
        aria-label="باز کردن منوی محصولات"
        aria-expanded={open ? "true" : undefined}
        sx={{ color: "primary.main", flexShrink: 0, width: 40, height: 40, p: 0.5 }}
      >
        <MenuRoundedIcon />
      </IconButton>

      <Drawer
        anchor="right"
        open={open}
        onClose={() => setOpen(false)}
        slotProps={{
          paper: {
            sx: {
              width: "min(88vw, 380px)",
              maxWidth: "100%",
              p: 2,
              bgcolor: "background.paper",
              borderInlineStart: `1px solid ${brandTokens.color.border}`,
              borderRadius: "0 0 0 28px",
              boxShadow: brandTokens.shadow.floating,
            },
          },
        }}
      >
        <Stack sx={{ height: "100%", minHeight: 0 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <CategoryMenuHeader mobile />
            </Box>
            <IconButton onClick={() => setOpen(false)} aria-label="بستن منوی محصولات">
              <CloseRoundedIcon />
            </IconButton>
          </Stack>
          <Divider sx={{ my: 2 }} />
          <Box sx={{ overflowY: "auto", minHeight: 0, pb: 2 }}>
            <CategoryMenuList items={items} onNavigate={() => setOpen(false)} />
          </Box>
          <Box sx={{ mt: "auto" }}>
            <CategoryMenuDivider />
            <Stack direction="row" gap={1} sx={{ color: "text.secondary", fontSize: 12 }}>
              <Box component="a" href="/store" onClick={() => setOpen(false)} sx={{ color: "inherit" }}>فروشگاه</Box>
              <Box component="a" href="/blog" onClick={() => setOpen(false)} sx={{ color: "inherit" }}>دانشنامه</Box>
            </Stack>
          </Box>
        </Stack>
      </Drawer>
    </>
  );
}
