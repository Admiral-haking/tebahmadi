import { Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogProps, DialogTitle, TextField } from "@mui/material";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import DialogCloseButton from "./dialog-close-button";

export function SaveDigikalaVendor({ onUpdate, service = 'dgk', ...props }: DialogProps & { onUpdate: VoidFunction, service?: string }) {
    const [name, setName] = useState("");
    const [loading, setLoading] = useState(false);

    function handleSave() {
        if (!name.trim()) { toast.error("نام شعبه را وارد کنید"); return; }
        setLoading(true);
        fetch("/api/vendors", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ vendors: name.trim(), service }),
        })
            .then(async (r) => {
                if (!r.ok) {
                    const payload = await r.json().catch(() => ({})) as { error?: string };
                    throw new Error(payload?.error || `خطای ${r.status}`);
                }
                return r.json();
            })
            .then(() => { toast.success("شعبه با موفقیت ذخیره شد"); onUpdate(); })
            .catch((err) => toast.error(err instanceof Error ? err.message : "خطا در ذخیره شعبه"))
            .finally(() => setLoading(false));
    }

    useEffect(() => { setName(""); }, [props.open]);

    return (
        <Dialog maxWidth="xs" fullWidth {...props}>
            <DialogTitle sx={{ position: "relative", pr: 6 }}>
                ایجاد شعبه
                <DialogCloseButton onClose={() => props.onClose?.({}, "escapeKeyDown")} disabled={loading} />
            </DialogTitle>
            <DialogContent>
                <TextField
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    label="نام شعبه"
                    variant="standard"
                    fullWidth
                    autoFocus
                    onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
                />
            </DialogContent>
            <DialogActions>
                <Button disabled={loading} onClick={() => props.onClose?.({}, "escapeKeyDown")}>
                    بازگشت
                </Button>
                <Button
                    variant="contained"
                    disabled={loading || !name.trim()}
                    startIcon={loading ? <CircularProgress size={16} /> : null}
                    onClick={handleSave}
                >
                    ذخیره
                </Button>
            </DialogActions>
        </Dialog>
    );
}
