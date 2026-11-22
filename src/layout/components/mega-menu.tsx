"use client";

import { CategoryDocument } from "@/catalog/models/Category";
import { Box, Button, IconButton, Popover, Stack } from "@mui/material";
import KeyboardArrowDownRoundedIcon from "@mui/icons-material/KeyboardArrowDownRounded";
import GridViewRoundedIcon from "@mui/icons-material/GridViewRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import { useMemo, useState } from "react";
import { brandTokens } from "@/theme/design-system";
import { buildCategoryMenuItems, CategoryMenuDivider, CategoryMenuHeader, CategoryMenuList } from "./category-menu";

type Props = {
  categories: CategoryDocument[];
};

export default function MegaMenu({ categories }: Props) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const items = useMemo(() => buildCategoryMenuItems(categories), [categories]);
  const open = Boolean(anchorEl);
  const close = () => setAnchorEl(null);

  return (
    <>
      <Button
        id="mega-btn-md"
        variant="contained"
        color="primary"
        aria-haspopup="menu"
        aria-expanded={open ? "true" : undefined}
        aria-controls={open ? "storefront-mega-menu" : undefined}
        onClick={(event) => setAnchorEl(event.currentTarget)}
        endIcon={<KeyboardArrowDownRoundedIcon sx={{ fontSize: 19 }} />}
        startIcon={<GridViewRoundedIcon sx={{ fontSize: 19 }} />}
        sx={{
          minHeight: 48,
          px: 2.1,
          gap: 0.25,
          flexShrink: 0,
          boxShadow: open ? `0 8px 20px ${brandTokens.color.primary}2b` : "none",
        }}
      >
        محصولات
      </Button>

      <Popover
        id="storefront-mega-menu"
        open={open}
        anchorEl={anchorEl}
        onClose={close}
        disableScrollLock
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{
          paper: {
            sx: {
              mt: 1.25,
              width: "min(360px, calc(100vw - 24px))",
              maxHeight: "min(70dvh, 560px)",
              overflowY: "auto",
              p: 1.25,
              border: `1px solid ${brandTokens.color.border}`,
              borderRadius: 3.5,
              bgcolor: "background.paper",
              boxShadow: brandTokens.shadow.floating,
              direction: "rtl",
            },
          },
        }}
      >
        <Stack id="storefront-mega-menu-content" sx={{ minWidth: 0 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <CategoryMenuHeader />
            </Box>
            <IconButton size="small" onClick={close} aria-label="بستن منوی محصولات" sx={{ flexShrink: 0 }}>
              <CloseRoundedIcon fontSize="small" />
            </IconButton>
          </Stack>
          <CategoryMenuDivider />
          <CategoryMenuList items={items} onNavigate={close} />
        </Stack>
      </Popover>
    </>
  );
}
