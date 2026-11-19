import { Refresh } from "@mui/icons-material";
import { IconButton, IconButtonProps } from "@mui/material";


export function RefreshButton(props: Omit<IconButtonProps, "children">) {
    return <IconButton {...props}>
        <Refresh />
    </IconButton>
}