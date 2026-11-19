"use client";

import { Badge, IconButton, NoSsr, Tooltip } from "@mui/material";
import ShoppingCartCheckoutRoundedIcon from "@mui/icons-material/ShoppingCartCheckoutRounded";
import { useRouter } from "next/navigation";

import { useCart } from "@/components/cart/useCart";

export default function CartButton() {
    const router = useRouter();
    const { itemsCount } = useCart();

    return (
        <NoSsr>
            <Tooltip title="سبد خرید">
                <IconButton
                    color="inherit"
                    onClick={() => router.push("/cart")}
                    aria-label="مشاهده سبد خرید"
                    sx={{
                        width: 42,
                        height: 42,
                        border: 1,
                        borderColor: "divider",
                        bgcolor: "background.paper",
                        boxShadow: "0 8px 20px rgba(var(--mui-palette-text-primaryChannel) / 0.08)",
                        "&:hover": {
                            bgcolor: "action.hover",
                        },
                    }}
                >
                    <Badge
                        color="primary"
                        badgeContent={itemsCount > 0 ? itemsCount : null}
                        overlap="circular"
                        sx={{
                            "& .MuiBadge-badge": {
                                minWidth: 18,
                                height: 18,
                                fontSize: 11,
                                fontWeight: 800,
                            },
                        }}
                    >
                        <ShoppingCartCheckoutRoundedIcon fontSize="small" />
                    </Badge>
                </IconButton>
            </Tooltip>
        </NoSsr>
    );
}
