"use client";

import { Box, Button, Dialog, DialogContent, IconButton, LinearProgress, Stack, Typography } from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { SmartPopupConfig, SmartPopupStep } from "@/views/admin/site-settings/hooks";

type SmartPopupProps = {
  config?: SmartPopupConfig | null;
};

function normalizePages(pages?: string[]) {
  return (pages ?? [])
    .map((page) => String(page ?? "").trim())
    .filter(Boolean);
}

function pageMatches(pathname: string, pages: string[]) {
  if (!pages.length) return true;
  return pages.some((pattern) => {
    if (pattern === "*") return true;
    if (pattern.endsWith("/*")) {
      const prefix = pattern.slice(0, -1);
      return pathname.startsWith(prefix);
    }
    return pathname === pattern;
  });
}

function normalizeSteps(steps?: SmartPopupStep[]) {
  return (steps ?? []).filter((step) => {
    return Boolean(step?.title?.trim() || step?.body?.trim() || step?.imageUrl?.trim());
  });
}

export default function SmartPopup({ config }: SmartPopupProps) {
  const pathname = usePathname() || "/";
  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  const steps = useMemo(() => normalizeSteps(config?.steps), [config?.steps]);
  const pages = useMemo(() => normalizePages(config?.pages), [config?.pages]);
  const storageKey = `smart-popup:${config?.version || "1"}`;
  const currentStep = steps[stepIndex];
  const isLastStep = stepIndex >= steps.length - 1;

  useEffect(() => {
    if (!config?.enabled || !steps.length || !pageMatches(pathname, pages)) {
      setOpen(false);
      return;
    }

    if (config.showOnce !== false && window.localStorage.getItem(storageKey) === "1") {
      setOpen(false);
      return;
    }

    const timer = window.setTimeout(() => {
      setStepIndex(0);
      setOpen(true);
    }, Math.max(0, Number(config.delayMs ?? 1200)));

    return () => window.clearTimeout(timer);
  }, [config?.enabled, config?.showOnce, config?.delayMs, pages, pathname, steps.length, storageKey]);

  function closePopup() {
    if (config?.showOnce !== false) {
      window.localStorage.setItem(storageKey, "1");
    }
    setOpen(false);
  }

  if (!config?.enabled || !currentStep) {
    return null;
  }

  const imageUrl = currentStep.imageUrl?.trim();
  const actionHref = currentStep.actionHref?.trim();

  return (
    <Dialog
      open={open}
      onClose={closePopup}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { borderRadius: 3, overflow: "hidden" } }}
    >
      <Box sx={{ position: "relative", bgcolor: "background.paper" }}>
        <IconButton
          aria-label="بستن"
          onClick={closePopup}
          sx={{ position: "absolute", top: 10, left: 10, zIndex: 2, bgcolor: "rgba(var(--mui-palette-common-backgroundChannel) / 0.86)" }}
        >
          <CloseRoundedIcon />
        </IconButton>

        {imageUrl ? (
          <Box
            component="img"
            src={imageUrl}
            alt={currentStep.title || "smart popup"}
            sx={{
              display: "block",
              width: "100%",
              height: { xs: 220, sm: 300 },
              objectFit: "cover",
              bgcolor: "grey.100",
            }}
          />
        ) : null}

        <DialogContent sx={{ px: { xs: 2.25, sm: 3 }, py: 3 }}>
          <Stack spacing={2}>
            {steps.length > 1 ? (
              <LinearProgress
                variant="determinate"
                value={((stepIndex + 1) / steps.length) * 100}
                sx={{ height: 6, borderRadius: 999 }}
              />
            ) : null}

            <Stack spacing={1}>
              {currentStep.title ? (
                <Typography variant="h5" fontWeight={900}>
                  {currentStep.title}
                </Typography>
              ) : null}
              {currentStep.body ? (
                <Typography variant="body1" color="text.secondary" sx={{ whiteSpace: "pre-line", lineHeight: 1.9 }}>
                  {currentStep.body}
                </Typography>
              ) : null}
            </Stack>

            <Stack direction={{ xs: "column", sm: "row" }} gap={1}>
              {actionHref && currentStep.actionLabel ? (
                <Button
                  variant="contained"
                  href={actionHref}
                  onClick={closePopup}
                  fullWidth
                  sx={{ fontWeight: 800 }}
                >
                  {currentStep.actionLabel}
                </Button>
              ) : null}
              {isLastStep ? (
                <Button variant={actionHref ? "outlined" : "contained"} onClick={closePopup} fullWidth>
                  بستن
                </Button>
              ) : (
                <Button variant="contained" onClick={() => setStepIndex((current) => current + 1)} fullWidth>
                  مرحله بعد
                </Button>
              )}
            </Stack>
          </Stack>
        </DialogContent>
      </Box>
    </Dialog>
  );
}
