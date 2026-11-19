"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Box, Dialog, Portal } from "@mui/material";

type Props = {
  src?: string | null;
  alt?: string;
  width?: number;
  height?: number;
  /** Size (px) of the floating zoom preview / modal max. */
  zoom?: number;
  sx?: object;
  style?: CSSProperties;
};

const FALLBACK = "/placeholder.jpg";

/**
 * A thumbnail that magnifies on hover (desktop) or opens a full-screen modal on
 * tap (touch). The hover preview loads the full image, is rendered in a body
 * portal (so table-cell overflow never clips it), and is positioned so it never
 * runs off the screen edges. Reusable everywhere a variant image is shown.
 */
export default function ZoomableImage({ src, alt = "", width = 40, height = 40, zoom = 320, sx, style }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [hovering, setHovering] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number }>({ left: 0, top: 0 });
  const [open, setOpen] = useState(false);
  const [canHover, setCanHover] = useState(true);

  useEffect(() => {
    // Touch devices report "hover: none" → use tap-to-modal instead of preview.
    setCanHover(window.matchMedia("(hover: hover)").matches);
  }, []);

  const url = src || FALLBACK;

  function computePos() {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const margin = 12;
    let left = rect.right + margin;
    if (left + zoom > window.innerWidth) left = rect.left - zoom - margin; // flip to the other side
    if (left < margin) left = Math.max(margin, (window.innerWidth - zoom) / 2);
    let top = rect.top + rect.height / 2 - zoom / 2;
    top = Math.min(Math.max(margin, top), window.innerHeight - zoom - margin);
    setPos({ left, top });
  }

  function handleEnter() {
    if (!canHover) return;
    computePos();
    setHovering(true);
  }

  return (
    <>
      <Box
        ref={ref}
        component="img"
        src={url}
        loading="lazy"
        alt={alt}
        onMouseEnter={handleEnter}
        onMouseLeave={() => setHovering(false)}
        onClick={(e) => { if (!canHover) { e.preventDefault(); e.stopPropagation(); setOpen(true); } }}
        width={width}
        height={height}
        style={style}
        sx={{ borderRadius: 0.6, objectFit: "cover", cursor: "zoom-in", flexShrink: 0, ...sx }}
      />

      {hovering && canHover && (
        <Portal>
          <Box
            sx={{
              position: "fixed",
              left: pos.left,
              top: pos.top,
              width: zoom,
              height: zoom,
              zIndex: (t) => t.zIndex.tooltip + 1,
              borderRadius: 1.5,
              overflow: "hidden",
              boxShadow: 8,
              border: 2,
              borderColor: "background.paper",
              bgcolor: "background.paper",
              pointerEvents: "none",
            }}
          >
            <Box component="img" src={url} alt={alt} sx={{ width: "100%", height: "100%", objectFit: "contain", bgcolor: "var(--mui-palette-common-white)" }} />
          </Box>
        </Portal>
      )}

      {!canHover && (
        <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm">
          <Box
            component="img"
            src={url}
            alt={alt}
            onClick={() => setOpen(false)}
            sx={{ width: "min(90vw, 520px)", height: "auto", display: "block", cursor: "zoom-out", bgcolor: "var(--mui-palette-common-white)" }}
          />
        </Dialog>
      )}
    </>
  );
}
