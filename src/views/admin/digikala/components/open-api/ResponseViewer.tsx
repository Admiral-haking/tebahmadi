"use client";

import { Box, Button, Chip, Collapse, Stack, Typography } from "@mui/material";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import { useState } from "react";
import { toast } from "sonner";

type Props = {
    response: string;
    responseStatus: number | null;
    loading: boolean;
};

function statusColor(status: number | null): "default" | "success" | "warning" | "error" {
    if (!status) return "default";
    if (status >= 200 && status < 300) return "success";
    if (status >= 400 && status < 500) return "warning";
    if (status >= 500) return "error";
    return "default";
}

export default function ResponseViewer({ response, responseStatus, loading }: Props) {
    const [expanded, setExpanded] = useState(true);

    function handleCopy() {
        if (!response) return;
        navigator.clipboard.writeText(response).then(() => toast.success("کپی شد")).catch(() => toast.error("کپی ناموفق"));
    }

    return (
        <Stack spacing={0}>
            {/* Header bar */}
            <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                sx={{
                    px: 1.5, py: 1,
                    border: "1px solid",
                    borderColor: "divider",
                    borderBottom: expanded ? "none" : "1px solid",
                    borderRadius: expanded ? "8px 8px 0 0" : 2,
                    bgcolor: "background.paper",
                    cursor: "pointer",
                }}
                onClick={() => setExpanded((v) => !v)}
            >
                <Stack direction="row" spacing={1.5} alignItems="center">
                    <Typography variant="subtitle2" fontWeight={700}>نتیجه عملیات</Typography>
                    {responseStatus && (
                        <Chip
                            size="small"
                            label={String(responseStatus)}
                            color={statusColor(responseStatus)}
                            sx={{ fontWeight: 700, fontFamily: "monospace" }}
                        />
                    )}
                    {loading && <Typography variant="caption" color="text.secondary">در حال دریافت...</Typography>}
                </Stack>
                <Stack direction="row" spacing={1} onClick={(e) => e.stopPropagation()}>
                    {response && (
                        <Button size="small" startIcon={<ContentCopyRoundedIcon />} onClick={handleCopy} sx={{ minWidth: 0 }}>
                            کپی
                        </Button>
                    )}
                    <Box
                        component={ExpandMoreRoundedIcon}
                        fontSize="small"
                        sx={{ transition: "transform .2s", transform: expanded ? "rotate(180deg)" : "none", color: "text.secondary" }}
                        onClick={() => setExpanded((v) => !v)}
                    />
                </Stack>
            </Stack>

            {/* Content */}
            <Collapse in={expanded}>
                <Box
                    component="pre"
                    dir="ltr"
                    sx={{
                        m: 0,
                        p: 2,
                        bgcolor: "var(--mui-palette-grey-900)",
                        color: "grey.100",
                        borderRadius: "0 0 8px 8px",
                        border: "1px solid",
                        borderColor: "divider",
                        borderTop: "none",
                        minHeight: 160,
                        maxHeight: 480,
                        overflow: "auto",
                        fontSize: 13,
                        fontFamily: "monospace",
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-all",
                        lineHeight: 1.6,
                    }}
                >
                    {response || (loading ? "در حال دریافت پاسخ..." : "هنوز عملیاتی اجرا نشده است.")}
                </Box>
            </Collapse>
        </Stack>
    );
}
