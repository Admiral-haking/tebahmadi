"use client";

import { useState } from "react";
import {
  Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Divider,
  Stack, TextField, Typography,
} from "@mui/material";
import DeleteSweepRoundedIcon from "@mui/icons-material/DeleteSweepRounded";
import { toast } from "sonner";
import DialogCloseButton from "./dialog-close-button";

/**
 * Danger action: wipe all Digikala/Snapp/Basalam ↔ site variant link records so
 * the admin can re-import everything. Requires typing «حذف» to confirm.
 */
export default function PanelDataResetButton() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      const r = await fetch("/api/admin/panel-data/reset", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "DELETE" }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok) throw new Error(j?.error || `خطای ${r.status}`);
      const d = j?.deleted ?? {};
      toast.success(`حذف شد — دیجی‌کالا: ${(d.dgk ?? 0).toLocaleString("fa-IR")}، اسنپ: ${(d.snp ?? 0).toLocaleString("fa-IR")}، باسلام: ${(d.bsl ?? 0).toLocaleString("fa-IR")}`);
      setOpen(false);
      setText("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا در حذف اطلاعات پنل‌ها");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button size="small" variant="outlined" color="error" startIcon={<DeleteSweepRoundedIcon />} onClick={() => { setText(""); setOpen(true); }}>
        حذف اطلاعات پنل‌ها
      </Button>

      <Dialog open={open} onClose={() => !busy && setOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ position: "relative", pr: 6 }}>
          حذف همهٔ اطلاعات پنل‌ها
          <DialogCloseButton onClose={() => setOpen(false)} disabled={busy} />
        </DialogTitle>
        <Divider />
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Alert severity="error">
              همهٔ رکوردهای اتصالِ واریانت‌های <b>دیجی‌کالا، اسنپ‌شاپ و باسلام</b> به سایت از دیتابیس حذف می‌شوند تا دوباره از ابتدا وارد/همگام‌سازی کنید.
              این عمل <b>غیرقابل‌بازگشت</b> است (محصولات سایت و سفارش‌ها دست‌نخورده می‌مانند).
            </Alert>
            <Typography variant="body2">برای تأیید، عبارت <b>حذف</b> را تایپ کنید:</Typography>
            <TextField
              size="small" value={text} onChange={(e) => setText(e.target.value)}
              placeholder="حذف" autoFocus disabled={busy}
            />
          </Stack>
        </DialogContent>
        <Divider />
        <DialogActions>
          <Button onClick={() => setOpen(false)} disabled={busy}>انصراف</Button>
          <Button variant="contained" color="error" onClick={run} disabled={busy || text.trim() !== "حذف"}>
            {busy ? "در حال حذف..." : "تأیید و حذف همه"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
