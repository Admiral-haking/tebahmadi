import { BarcodeReader, ContentCopyRounded, Delete } from "@mui/icons-material";
import { Box, Button, Chip, Dialog, DialogContent, DialogTitle, Divider, IconButton, LinearProgress, Stack, TextField, Typography } from "@mui/material";
import axios from "axios";
import { useEffect, useState } from "react";
import { toast } from "sonner";


type IPrefix = {
    name: string
    prefix: string
    last: number;
}

function formatBarcode(prefix: string, value: number) {
    return `${prefix}-${Math.max(0, value).toString().padStart(6, "0")}`;
}

async function copyText(text: string) {
    if (window.navigator.clipboard?.writeText) {
        try {
            await window.navigator.clipboard.writeText(text);
            return;
        } catch {
            // Clipboard API can fail outside secure contexts; fall back to execCommand.
        }
    }

    const input = document.createElement("textarea");
    input.value = text;
    input.setAttribute("readonly", "true");
    input.style.position = "fixed";
    input.style.insetInlineStart = "-9999px";
    document.body.appendChild(input);
    input.select();
    const copied = document.execCommand("copy");
    document.body.removeChild(input);
    if (!copied) throw new Error("copy_failed");
}

export default function BarcodeFinder() {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    const [prefixes, setPrefixes] = useState<IPrefix[]>();

    const [form, setForm] = useState<Omit<IPrefix, "last">>({
        name: "",
        prefix: ""
    })

    function load() {
        setLoading(true);
        axios.get("/api/barcode")
            .then(res => setPrefixes(res.data))
            .catch(() => {
                toast.error("عه! جون تو نموتونم اطلاعاته ر بخونوم! خار ای کاره!!!");
                setPrefixes([]);
            })
            .finally(() => setLoading(false));
    }

    function save() {
        setLoading(true);
        axios.post("/api/barcode", form)
            .then(() => {
                load();
                setForm({ name: "", prefix: "" });
            })
            .catch(() => toast.error("جون تو صحنه یه! نمشه!"))
            .finally(() => setLoading(false));
    }

    async function copyNextBarcode(item: IPrefix) {
        setLoading(true);
        try {
            const { data } = await axios.patch("/api/barcode", {
                prefix: item.prefix,
                inc: 1,
            });
            const nextCode =
                Array.isArray(data?.codes) && data.codes.length
                    ? String(data.codes[0])
                    : formatBarcode(String(data?.prefix || item.prefix), Number(data?.start || item.last + 1));

            await copyText(nextCode);
            toast.success(`کد ${nextCode} کپی شد و بارکد بعدی آماده است.`);
            load();
        } catch {
            toast.error("کپی یا رزرو کد بعدی انجام نشد.");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        if (open)
            load();
        const timer = setInterval(() => {
            setOpen(l => {
                if (l) load();
                return l;
            })
        }, 15e3);
        return () => clearInterval(timer);
    }, []);


    return <>
        <IconButton aria-label="باز کردن بارکدخوان" onClick={() => setOpen(true)}>
            <BarcodeReader />
        </IconButton>
        <Dialog
            open={open}
            onClose={() => setOpen(false)}
            maxWidth="sm"
            fullWidth>
            {loading && <LinearProgress />}
            <DialogTitle>
                <Stack direction="row" gap={2} alignItems="center">
                    <Typography variant="h6">
                        بارکد گیری
                    </Typography>
                    <Box flex="1 1 auto" />
                    <IconButton onClick={() => setOpen(false)} aria-label="close window">
                        <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24">
                            <path
                                fill="currentColor"
                                d="m6.4 19l-1.4-1.4l5.6-5.6l-5.6-5.6l1.4-1.4l5.6 5.6l5.6-5.6l1.4 1.4l-5.6 5.6l5.6 5.6l-1.4 1.4l-5.6-5.6z"
                            />
                        </svg>
                    </IconButton>
                </Stack>
            </DialogTitle>
            <DialogContent>
                {
                    prefixes?.map(item => <Stack
                        key={item.prefix}
                        gap={1}
                        sx={{ my: 2 }}
                        direction="row"
                    >

                        <Chip
                            variant="filled"
                            color="warning"
                            label={item.name}
                        />

                        <Chip
                            variant="outlined"
                            label={formatBarcode(item.prefix, item.last + 1)}
                        />

                        <Box flex="1 1 auto" />
                        <IconButton
                            aria-label={`کپی کد ${item.name}`}
                            disabled={loading}
                            onClick={() => void copyNextBarcode(item)}>
                            <ContentCopyRounded />
                        </IconButton>
                        <IconButton
                            aria-label={`حذف پیشوند ${item.name}`}
                            disabled={loading}
                            onClick={() => {
                                setLoading(true);
                                axios.delete("api/barcode", { params: { prefix: item.prefix } })
                                    .then(() => {
                                        load();
                                        setForm({ name: "", prefix: "" });
                                    })
                                    .catch(() => toast.error("جون تو صحنه یه! نمشه!"))
                                    .finally(() => setLoading(false));
                            }}>
                            <Delete />
                        </IconButton>
                    </Stack>
                    )
                }

                <Divider sx={{ my: 4 }} />

                <Stack direction="row" gap={2}>
                    <TextField
                        label="نام"
                        value={form.name}
                        onChange={(e) => setForm(l => ({ ...l, name: e.target.value }))}
                        fullWidth
                    />
                    <TextField
                        label="پریفیکس"
                        value={form.prefix}
                        onChange={(e) => setForm(l => ({ ...l, prefix: e.target.value }))}
                        fullWidth
                    />
                </Stack>
                <Button
                    fullWidth
                    variant="contained"
                    onClick={save}
                    sx={{ mt: 2 }}
                >
                    ایجاد جدید
                </Button>
            </DialogContent>
        </Dialog>
    </>

}
