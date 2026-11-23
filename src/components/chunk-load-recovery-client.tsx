"use client";

import { useEffect } from "react";

import { isChunkLoadError } from "./chunk-load-recovery";

const RECOVERY_KEY = "tebahmadi:chunk-recovery";
const RECOVERY_PARAM = "__chunk_recovery";
let recoveryAttemptedInMemory = false;

function recoverFromChunkFailure(): void {
  let alreadyAttempted = recoveryAttemptedInMemory;

  try {
    alreadyAttempted = alreadyAttempted || sessionStorage.getItem(RECOVERY_KEY) === "1";
  } catch {
    // Fall back to the module-level guard when storage is unavailable.
  }

  if (alreadyAttempted) {
    return;
  }

  recoveryAttemptedInMemory = true;

  try {
    sessionStorage.setItem(RECOVERY_KEY, "1");
  } catch {
    // The in-memory guard still prevents an infinite reload loop.
  }

  const url = new URL(window.location.href);
  url.searchParams.set(RECOVERY_PARAM, String(Date.now()));
  window.location.replace(url.toString());
}

function clearRecoveryMarker(): void {
  try {
    sessionStorage.removeItem(RECOVERY_KEY);
  } catch {
    // Ignore storage restrictions; the current page can still operate normally.
  }

  const url = new URL(window.location.href);
  if (!url.searchParams.has(RECOVERY_PARAM)) {
    return;
  }

  url.searchParams.delete(RECOVERY_PARAM);
  window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
}

export default function ChunkLoadRecovery() {
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      if (isChunkLoadError(event.error ?? event.message)) {
        recoverFromChunkFailure();
      }
    };
    const handleRejection = (event: PromiseRejectionEvent) => {
      if (isChunkLoadError(event.reason)) {
        recoverFromChunkFailure();
      }
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleRejection);
    const timer = window.setTimeout(clearRecoveryMarker, 5000);

    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
      window.clearTimeout(timer);
    };
  }, []);

  return null;
}
