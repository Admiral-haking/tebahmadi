"use client";

import { Box, Button, ButtonProps, Container, Dialog, DialogActions, DialogContent, DialogProps, DialogTitle, IconButton, Stack, Typography } from "@mui/material";
import { ReactNode, useState } from "react";

type Props = {
    buttonProps: Omit<ButtonProps, "onClick">
    dialogProps?: Omit<DialogProps, "open" | "onClick">
    children?: ReactNode
    hideFinish?: boolean
    title?: string
    mountChildrenOnOpen?: boolean
}
export default function Orderly({ buttonProps, dialogProps = {}, children, hideFinish = false, title, mountChildrenOnOpen = false }: Props) {
    const [open, setOpen] = useState(false);
    return <>
        <Button {...buttonProps} onClick={() => setOpen(true)} />
        <Dialog maxWidth="lg" fullWidth {...dialogProps} open={open} onClose={() => setOpen(false)}>
            <DialogTitle>
                <Stack direction="row" gap={2} alignItems="center">
                    {buttonProps.startIcon || buttonProps.endIcon}
                    <Typography variant="h6">
                        {
                            title || buttonProps.children
                        }
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
                <Container maxWidth="lg" sx={{ py: 2 }}>
                    {
                        mountChildrenOnOpen ?
                            open && children :
                            children
                    }


                </Container>
            </DialogContent>
            {!hideFinish && <DialogActions>
                <Button onClick={() => setOpen(false)} size="small">
                    بازگشت
                </Button>
            </DialogActions>}
        </Dialog>
    </>
}