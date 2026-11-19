"use client";

import { Box, Button, Chip, InputAdornment, Stack, Tab, Tabs, TextField, Tooltip, Typography } from "@mui/material";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import type { WorkflowKey } from "./types";
import { WORKFLOWS, WORKFLOW_STEPS } from "./constants";

type Props = {
    vendorId: string;
    activeWorkflow: WorkflowKey;
    query: string;
    onWorkflowChange: (wf: WorkflowKey) => void;
    onQueryChange: (q: string) => void;
    onOpenPreferences: () => void;
    filteredCount: number;
};

export default function WorkflowBar({
    vendorId, activeWorkflow, query,
    onWorkflowChange, onQueryChange, onOpenPreferences,
    filteredCount,
}: Props) {
    const activeWf = WORKFLOWS.find((w) => w.key === activeWorkflow) ?? WORKFLOWS[0];

    return (
        <Stack spacing={2}>
            {/* Header row */}
            <Stack direction={{ xs: "column", md: "row" }} alignItems={{ xs: "stretch", md: "center" }} justifyContent="space-between" gap={1.5}>
                <Stack spacing={0.25}>
                    <Typography variant="h6" fontWeight={800}>
                        ابزارهای Open API دیجی‌کالا
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                        فروشنده: <strong>{vendorId}</strong> — عملیات را انتخاب کنید و فرم فارسی را تکمیل کنید
                    </Typography>
                </Stack>
                <Stack direction="row" spacing={1} alignItems="center">
                    <TextField
                        size="small"
                        placeholder="جستجو در عملیات..."
                        value={query}
                        onChange={(e) => onQueryChange(e.target.value)}
                        slotProps={{
                            input: {
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <SearchRoundedIcon fontSize="small" />
                                    </InputAdornment>
                                ),
                            },
                        }}
                        sx={{ minWidth: 220 }}
                    />
                    <Tooltip title="تنظیمات پیش‌فرض">
                        <Button
                            variant="outlined"
                            size="small"
                            startIcon={<TuneRoundedIcon />}
                            onClick={onOpenPreferences}
                        >
                            تنظیمات
                        </Button>
                    </Tooltip>
                </Stack>
            </Stack>

            {/* Workflow tabs */}
            <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
                <Tabs
                    value={activeWorkflow}
                    onChange={(_, v) => onWorkflowChange(v)}
                    variant="scrollable"
                    scrollButtons="auto"
                    sx={{ minHeight: 44 }}
                >
                    {WORKFLOWS.map((wf) => (
                        <Tab
                            key={wf.key}
                            value={wf.key}
                            label={
                                <Stack direction="row" spacing={0.75} alignItems="center">
                                    <span>{wf.icon}</span>
                                    <span>{wf.label}</span>
                                </Stack>
                            }
                            sx={{ minHeight: 44, py: 1 }}
                        />
                    ))}
                </Tabs>
            </Box>

            {/* Workflow description + step chips */}
            <Stack direction={{ xs: "column", sm: "row" }} gap={1.5} alignItems={{ xs: "flex-start", sm: "center" }}>
                <Typography variant="body2" color="text.secondary" sx={{ flex: "1 1 auto" }}>
                    {activeWf.helper}
                </Typography>
                <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ flexShrink: 0 }}>
                    {WORKFLOW_STEPS[activeWorkflow].map((step, i) => (
                        <Chip key={step} size="small" label={`${i + 1}. ${step}`} variant="outlined" />
                    ))}
                    <Chip size="small" label={`${filteredCount} عملیات`} color="default" />
                </Stack>
            </Stack>
        </Stack>
    );
}
