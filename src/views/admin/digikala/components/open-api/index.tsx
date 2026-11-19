"use client";

import { Box, Paper, Stack } from "@mui/material";
import { useState } from "react";
import WorkflowBar from "./WorkflowBar";
import EndpointList from "./EndpointList";
import RequestForm from "./RequestForm";
import ResponseViewer from "./ResponseViewer";
import PreferencesDialog from "./PreferencesDialog";
import { useOpenApi } from "./use-open-api";
import type { WorkflowKey } from "./types";

export default function DigikalaOpenApiExplorer({ vendorId }: { vendorId: string }) {
    const [prefsOpen, setPrefsOpen] = useState(false);
    const api = useOpenApi(vendorId);

    return (
        <Stack spacing={2.5} sx={{ mt: 3 }}>
            {/* Top bar: workflow selector + search + prefs button */}
            <Paper elevation={0} sx={{ p: { xs: 1.5, md: 2 }, border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
                <WorkflowBar
                    vendorId={vendorId}
                    activeWorkflow={api.activeWorkflow}
                    query={api.query}
                    filteredCount={api.filteredCatalog.length}
                    onWorkflowChange={(wf: WorkflowKey) => api.resetToWorkflow(wf)}
                    onQueryChange={api.setQuery}
                    onOpenPreferences={() => setPrefsOpen(true)}
                />
            </Paper>

            {/* Two-column layout: endpoint list | request form */}
            <Box
                sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 2fr) minmax(0, 3fr)" },
                    gap: 2,
                    alignItems: "start",
                }}
            >
                {/* Left: Scrollable endpoint list */}
                <Paper
                    elevation={0}
                    sx={{
                        border: "1px solid",
                        borderColor: "divider",
                        borderRadius: 2,
                        overflow: "hidden",
                    }}
                >
                    <Box
                        sx={{
                            p: 1.5,
                            maxHeight: { xs: 360, lg: 620 },
                            overflowY: "auto",
                            "&::-webkit-scrollbar": { width: 6 },
                            "&::-webkit-scrollbar-thumb": { borderRadius: 3, bgcolor: "divider" },
                        }}
                    >
                        <EndpointList
                            items={api.filteredCatalog}
                            selectedValue={api.selectedValue}
                            onSelect={api.applyEndpoint}
                        />
                    </Box>
                </Paper>

                {/* Right: Request form */}
                <Paper
                    elevation={0}
                    sx={{
                        p: { xs: 1.5, md: 2 },
                        border: "1px solid",
                        borderColor: api.selectedEndpoint ? "primary.light" : "divider",
                        borderRadius: 2,
                        position: { lg: "sticky" },
                        top: { lg: 72 },
                    }}
                >
                    <RequestForm
                        selectedEndpoint={api.selectedEndpoint}
                        method={api.method}
                        placeholders={api.placeholders}
                        pathParams={api.pathParams}
                        bodyFields={api.bodyFields}
                        bodyFieldValues={api.bodyFieldValues}
                        fileUpload={api.fileUpload}
                        fileFieldName={api.fileFieldName}
                        file={api.file}
                        loading={api.loading}
                        hasMissingPathParam={api.hasMissingPathParam}
                        showAdvanced={api.showAdvanced}
                        rawDownload={api.rawDownload}
                        downloadable={api.downloadable}
                        url={api.url}
                        body={api.body}
                        aiPrompt={api.aiPrompt}
                        aiLoading={api.aiLoading}
                        onPathParamChange={(key, value) => api.setPathParams((cur) => ({ ...cur, [key]: value }))}
                        onBodyFieldChange={(key, value) => api.setBodyFieldValues((cur) => ({ ...cur, [key]: value }))}
                        onFileFieldNameChange={api.setFileFieldName}
                        onFileChange={api.setFile}
                        onRawDownloadToggle={() => api.setRawDownload((v) => !v)}
                        onShowAdvancedToggle={() => api.setShowAdvanced((v) => !v)}
                        onBodyChange={api.setBody}
                        onAiPromptChange={api.setAiPrompt}
                        onAiFill={api.handleAiFill}
                        onSend={api.handleSend}
                    />
                </Paper>
            </Box>

            {/* Response panel */}
            <ResponseViewer
                response={api.response}
                responseStatus={api.responseStatus}
                loading={api.loading}
            />

            {/* Preferences dialog */}
            <PreferencesDialog
                open={prefsOpen}
                preferences={api.preferences}
                saving={api.savingPreferences}
                onChange={(patch) => api.setPreferences((cur) => ({ ...cur, ...patch }))}
                onSave={async () => { await api.handleSavePreferences(); setPrefsOpen(false); }}
                onClose={() => setPrefsOpen(false)}
            />
        </Stack>
    );
}
