"use client";

import { Badge, IconButton, NoSsr, Tooltip } from "@mui/material";
import { useRouter } from "next/navigation";
import { useCart } from "@/components/cart/useCart";
import { BrandIcon } from "@/components/brand-icons";
import { TEB_COLORS } from "@/theme/tokens";
import { formatFaNumber } from "@/lib/format";

export default function CartButton() {
    const router = useRouter();
    const { itemsCount } = useCart();

    return (
        <NoSsr>
            <Tooltip title="سبد خرید">
                <IconButton
                    onClick={() => router.push("/cart")}
                    aria-label="مشاهده سبد خرید"
                    sx={{
                        width: 44,
                        height: 44,
                        borderRadius: "10px",
                        border: `1px solid ${TEB_COLORS.border}`,
                        bgcolor: TEB_COLORS.softSurface,
                        color: TEB_COLORS.primary,
                        transition: "background-color 0.18s ease, border-color 0.18s ease",
                        "&:hover": {
                            bgcolor: TEB_COLORS.surface,
                            borderColor: TEB_COLORS.primary,
                        },
                    }}
                >
                    <Badge
                        badgeContent={itemsCount > 0 ? formatFaNumber(itemsCount) : null}
                        overlap="circular"
                        sx={{
                            "& .MuiBadge-badge": {
                                minWidth: 18,
                                height: 18,
                                fontSize: "11px",
                                fontWeight: 700,
                                bgcolor: TEB_COLORS.error,
                                color: "#FFFFFF",
                            },
                        }}
                    >
                        <BrandIcon name="cart" size={19} strokeWidth={2} />
                    </Badge>
                </IconButton>
            </Tooltip>
        </NoSsr>
    );
}
