import { Refresh } from "@mui/icons-material";
import { IconButton, IconButtonProps } from "@mui/material";


export function RefreshButton(props: Omit<IconButtonProps, "children">) {
    const { "aria-label": ariaLabel, ...buttonProps } = props;

    return <IconButton aria-label={ariaLabel ?? "به‌روزرسانی"} {...buttonProps}>
        <Refresh />
    </IconButton>
}
