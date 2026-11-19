import { Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogProps, DialogTitle, TextField } from "@mui/material";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import DialogCloseButton from "./dialog-close-button";

export function SaveDigikalaKeys({ onUpdate, vendorId, ...props }: DialogProps & { onUpdate: VoidFunction, vendorId: string }) {
    const [privateKey, setPrivateKey] = useState("");
    const [publicKey, setPublicKey] = useState("");
    const [loading, setLoading] = useState(false);

    function handleSave() {
        if (!privateKey.trim() || !publicKey.trim()) { toast.error("هر دو کلید لازم است"); return; }
        const confirmed = window.confirm("کلیدهای قبلی از دسترس خارج خواهند شد. از این عملیات اطمینان دارید؟");
        if (!confirmed) return;

        setLoading(true);
        fetch("/api/digikala/auth", {
            method: "PUT",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ vendorId, publicKey: publicKey.trim(), privateKey: privateKey.trim() }),
        })
            .then(async (r) => {
                if (!r.ok) {
                    const payload = await r.json().catch(() => ({})) as { error?: string };
                    throw new Error(payload?.error || `خطای ${r.status}`);
                }
                return r.json();
            })
            .then(() => { toast.success("کلیدها با موفقیت ذخیره شدند"); onUpdate(); })
            .catch((err) => toast.error(err instanceof Error ? err.message : "خطا در ذخیره کلیدها"))
            .finally(() => setLoading(false));
    }

    useEffect(() => { setPrivateKey(""); setPublicKey(""); }, [props.open]);

    return (
        <Dialog maxWidth="xs" fullWidth {...props}>
            <DialogTitle sx={{ position: "relative", pr: 6 }}>
                ذخیره کلید عمومی / خصوصی
                <DialogCloseButton onClose={() => props.onClose?.({}, "escapeKeyDown")} disabled={loading} />
            </DialogTitle>
            <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
                <TextField
                    value={privateKey}
                    onChange={(e) => setPrivateKey(e.target.value)}
                    label="کلید خصوصی"
                    variant="standard"
                    fullWidth
                    multiline
                    rows={6}
                    slotProps={{ input: { dir: "ltr", style: { fontFamily: "monospace", fontSize: 12 } } }}
                />
                <TextField
                    value={publicKey}
                    onChange={(e) => setPublicKey(e.target.value)}
                    label="کلید عمومی"
                    variant="standard"
                    fullWidth
                    multiline
                    rows={6}
                    slotProps={{ input: { dir: "ltr", style: { fontFamily: "monospace", fontSize: 12 } } }}
                />
            </DialogContent>
            <DialogActions>
                <Button disabled={loading} onClick={() => props.onClose?.({}, "escapeKeyDown")}>
                    بازگشت
                </Button>
                <Button
                    variant="contained"
                    disabled={loading || !privateKey.trim() || !publicKey.trim()}
                    startIcon={loading ? <CircularProgress size={16} /> : null}
                    onClick={handleSave}
                >
                    ذخیره
                </Button>
            </DialogActions>
        </Dialog>
    );
}
