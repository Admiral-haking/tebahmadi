"use client";

import { Box, Chip, Paper, Stack, Typography } from "@mui/material";
import type { DgkOpenApiEndpoint } from "@/digikala/constants/open-api-catalog";
import { GROUP_LABELS, METHOD_COLORS, METHOD_LABELS, WRITE_METHODS } from "./constants";
import { persianActionTitle } from "./utils";
import type { Method } from "./types";

type Props = {
    items: DgkOpenApiEndpoint[];
    selectedValue: string;
    onSelect: (index: string) => void;
};

export default function EndpointList({ items, selectedValue, onSelect }: Props) {
    if (items.length === 0) {
        return (
            <Box sx={{ py: 6, textAlign: "center" }}>
                <Typography color="text.secondary" variant="body2">
                    عملیاتی یافت نشد
                </Typography>
            </Box>
        );
    }

    return (
        <Stack spacing={0.75}>
            {items.map((item, index) => {
                const key = String(index);
                const selected = selectedValue === key;
                const isWrite = WRITE_METHODS.has(item.method as Method);
                const titleFa = persianActionTitle(item.title, item.path, item.method as Method);

                return (
                    <Paper
                        key={`${item.method}:${item.path}:${index}`}
                        elevation={0}
                        onClick={() => onSelect(key)}
                        sx={{
                            p: 1.25,
                            border: "1px solid",
                            borderColor: selected ? "primary.main" : "divider",
                            borderRadius: 2,
                            bgcolor: selected ? "primary.50" : "background.paper",
                            cursor: "pointer",
                            transition: "border-color .15s, background-color .15s",
                            "&:hover": {
                                borderColor: selected ? "primary.main" : "primary.light",
                                bgcolor: selected ? "primary.50" : "action.hover",
                            },
                        }}
                    >
                        <Stack spacing={0.5}>
                            <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                                <Chip
                                    size="small"
                                    label={METHOD_LABELS[item.method as Method]}
                                    color={METHOD_COLORS[item.method as Method]}
                                    sx={{ fontWeight: 700, fontSize: "0.7rem", height: 20 }}
                                />
                                <Chip
                                    size="small"
                                    label={GROUP_LABELS[item.group] ?? item.group}
                                    variant="outlined"
                                    sx={{ fontSize: "0.68rem", height: 20 }}
                                />
                            </Stack>
                            <Typography
                                variant="body2"
                                fontWeight={selected ? 700 : 500}
                                color={selected ? "primary.main" : "text.primary"}
                                sx={{ lineHeight: 1.4 }}
                            >
                                {titleFa}
                            </Typography>
                            {isWrite && (
                                <Typography variant="caption" color="warning.main" sx={{ fontSize: "0.68rem" }}>
                                    تغییر داده در دیجی‌کالا
                                </Typography>
                            )}
                        </Stack>
                    </Paper>
                );
            })}
        </Stack>
    );
}
