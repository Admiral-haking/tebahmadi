import { IconButton, Tooltip } from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";

/**
 * A small absolutely-positioned close (✕) button for dialog titles. Many of the
 * Digikala dialogs only offered a backdrop click or an action-row button to
 * dismiss; this gives every one of them a consistent corner ✕.
 *
 * Place it as the last child of a (position:relative) DialogTitle, or anywhere
 * inside a Dialog — it pins to the top-inline-end corner. RTL-aware via `insetInlineEnd`.
 */
export default function DialogCloseButton({ onClose, disabled }: { onClose: () => void; disabled?: boolean }) {
    return (
        <Tooltip title="بستن">
            <span style={{ position: "absolute", insetInlineEnd: 8, top: 8, zIndex: 1 }}>
                <IconButton aria-label="بستن" size="small" onClick={onClose} disabled={disabled}>
                    <CloseRoundedIcon fontSize="small" />
                </IconButton>
            </span>
        </Tooltip>
    );
}
