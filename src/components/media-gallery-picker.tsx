"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  IconButton, InputAdornment, Pagination, Stack, TextField, Tooltip, Typography,
} from "@mui/material";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";

type MediaItem = { id: string; filename: string; thumbId?: string; originalId?: string; createdAt?: string };

const faDate = (iso?: string) => {
  if (!iso) return "";
  try { return new Intl.DateTimeFormat("fa-IR-u-ca-persian", { dateStyle: "short" }).format(new Date(iso)); } catch { return ""; }
};

/**
 * Pick one or more images from the site's media gallery. Grid with lazy-loaded
 * thumbnails, filename search, date sort (newest first), pagination, a preview of
 * the current selection, and confirm. Returns media ids in the SAME format the
 * uploader produces, so callers store them exactly like a direct upload.
 */
export default function MediaGalleryPicker({
  open, onClose, multiple = false, onSelect, maxFiles,
}: {
  open: boolean;
  onClose: () => void;
  multiple?: boolean;
  onSelect: (ids: string[]) => void;
  maxFiles?: number;
}) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => { if (!open) { setSelected(new Set()); setQ(""); setDebouncedQ(""); setPage(1); } }, [open]);
  useEffect(() => { const h = setTimeout(() => { setDebouncedQ(q.trim()); setPage(1); }, 400); return () => clearTimeout(h); }, [q]);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), scope: "all", kind: "image" });
    if (debouncedQ) params.set("q", debouncedQ);
    fetch(`/api/admin/media?${params.toString()}`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { items: [], pages: 1 }))
      .then((d) => { if (!alive) return; setItems(Array.isArray(d?.items) ? d.items : []); setPages(Math.max(1, Number(d?.pages) || 1)); })
      .catch(() => { if (alive) setItems([]); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [open, page, debouncedQ]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); return next; }
      if (!multiple) return new Set([id]);
      if (maxFiles && next.size >= maxFiles) return prev;
      next.add(id);
      return next;
    });
  }

  const selectedList = useMemo(() => Array.from(selected), [selected]);

  function confirm() {
    if (!selectedList.length) return;
    onSelect(selectedList);
    onClose();
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ position: "relative", pr: 6 }}>
        انتخاب از گالری سایت
        <IconButton aria-label="بستن" size="small" onClick={onClose} sx={{ position: "absolute", insetInlineEnd: 8, top: 8 }}>
          <CloseRoundedIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Stack gap={1.5}>
          <TextField
            size="small"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="جستجو بر اساس نام فایل..."
            slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchRoundedIcon fontSize="small" /></InputAdornment> } }}
          />

          {loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>
          ) : items.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 6, textAlign: "center" }}>
              {debouncedQ ? `برای «${debouncedQ}» تصویری یافت نشد.` : "تصویری در گالری نیست."}
            </Typography>
          ) : (
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(3, 1fr)", sm: "repeat(5, 1fr)", md: "repeat(6, 1fr)" }, gap: 1 }}>
              {items.map((it) => {
                const isSel = selected.has(it.id);
                return (
                  <Tooltip key={it.id} title={`${it.filename}${it.createdAt ? ` · ${faDate(it.createdAt)}` : ""}`}>
                    <Box
                      onClick={() => toggle(it.id)}
                      sx={{
                        position: "relative", aspectRatio: "1 / 1", borderRadius: 1, overflow: "hidden",
                        border: 2, borderColor: isSel ? "primary.main" : "divider", cursor: "pointer",
                        "&:hover": { borderColor: "primary.light" },
                      }}
                    >
                      <Box component="img" src={`/api/media/${it.thumbId || it.id}?type=thumb`} loading="lazy" alt={it.filename}
                        sx={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      {isSel && (
                        <CheckCircleRoundedIcon color="primary"
                          sx={{ position: "absolute", top: 2, insetInlineEnd: 2, bgcolor: "background.paper", borderRadius: "50%" }} />
                      )}
                    </Box>
                  </Tooltip>
                );
              })}
            </Box>
          )}

          {pages > 1 && (
            <Stack alignItems="center">
              <Pagination size="small" page={page} count={pages} onChange={(_, p) => setPage(p)} />
            </Stack>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Typography variant="caption" color="text.secondary" sx={{ mr: "auto", pl: 1 }}>
          {selectedList.length > 0 ? `${selectedList.length.toLocaleString("fa-IR")} تصویر انتخاب شده` : "تصویری انتخاب نشده"}
        </Typography>
        <Button onClick={onClose}>انصراف</Button>
        <Button variant="contained" onClick={confirm} disabled={!selectedList.length}>
          افزودن {selectedList.length > 0 ? `(${selectedList.length.toLocaleString("fa-IR")})` : ""}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
