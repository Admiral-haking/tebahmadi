"use client"
import { useState } from "react";
import { Box, Button, Pagination, Stack, TextField, Typography } from "@mui/material";
import { useRouter } from "next/navigation"

/** Convert Persian/Arabic-Indic digits to ASCII and keep only digits. */
function toLatinDigits(input: string): string {
    let out = "";
    for (const ch of input) {
        const c = ch.codePointAt(0)!;
        if (c >= 0x06f0 && c <= 0x06f9) out += String(c - 0x06f0);        // ۰-۹
        else if (c >= 0x0660 && c <= 0x0669) out += String(c - 0x0660);  // ٠-٩
        else if (ch >= "0" && ch <= "9") out += ch;
    }
    return out;
}

/**
 * Standalone "jump to page" box (input + برو) for lists that render their own
 * MUI <Pagination> instead of AppPagination. Accepts Persian/English digits,
 * clamps to [1, pages], ignores non-numeric input, and submits on Enter or click.
 */
export function PageJumper({ pages, onJump }: { pages: number; onJump: (p: number) => void }) {
    const [jump, setJump] = useState("");
    if (!pages || pages <= 1) return null;

    function submit() {
        const digits = toLatinDigits(jump);
        if (!digits) return;
        const target = Math.min(Math.max(1, Math.floor(Number(digits))), Math.max(1, pages));
        onJump(target);
        setJump("");
    }

    return (
        <Stack direction="row" alignItems="center" gap={0.75}>
            <Typography variant="caption" color="text.secondary">برو به صفحه:</Typography>
            <TextField
                size="small"
                value={jump}
                onChange={(e) => setJump(toLatinDigits(e.target.value))}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } }}
                placeholder={`۱-${pages.toLocaleString("fa-IR")}`}
                inputProps={{ inputMode: "numeric", style: { width: 64, textAlign: "center" } }}
            />
            <Button size="small" variant="outlined" onClick={submit}>برو</Button>
        </Stack>
    );
}

export default function AppPagination({ page, pages, onChange }: { pages: number, page: number, onChange?: (p: number) => any }) {
    const router = useRouter();
    const [jump, setJump] = useState("");

    function navigate(p: number) {
        // Clamp to a valid page so out-of-range input never errors.
        const target = Math.min(Math.max(1, Math.floor(p)), Math.max(1, pages));
        if (onChange) return onChange(target);
        const params = new URLSearchParams(window.location.search);
        params.delete("page");
        params.delete("add");
        params.append("page", target.toString());
        router.push(`?${params.toString()}`);
    }

    function submitJump() {
        const digits = toLatinDigits(jump);
        if (!digits) return; // ignore non-numeric / empty input
        navigate(Number(digits));
        setJump("");
    }

    return (
        <Stack direction="row" alignItems="center" gap={1.5} flexWrap="wrap" justifyContent="center">
            <Pagination
                count={pages}
                page={page}
                onChange={(_, p) => navigate(p)}
            />
            {pages > 1 && (
                <Stack direction="row" alignItems="center" gap={0.75}>
                    <Typography variant="caption" color="text.secondary">برو به صفحه:</Typography>
                    <TextField
                        size="small"
                        value={jump}
                        onChange={(e) => setJump(toLatinDigits(e.target.value))}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submitJump(); } }}
                        placeholder={`۱-${pages.toLocaleString("fa-IR")}`}
                        inputProps={{ inputMode: "numeric", style: { width: 64, textAlign: "center" } }}
                    />
                    <Button size="small" variant="outlined" onClick={submitJump}>برو</Button>
                    <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>
                        <Typography variant="caption" color="text.secondary">
                            از {pages.toLocaleString("fa-IR")}
                        </Typography>
                    </Box>
                </Stack>
            )}
        </Stack>
    );
}
