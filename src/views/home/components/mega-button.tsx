"use client"

import { Button, ButtonProps } from "@mui/material"
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';


export default function MegaButton(props: ButtonProps) {
    const theme = useTheme();

    const isMobile = useMediaQuery(theme.breakpoints.down('md'));

    function handleClick() {
        const btn = document.getElementById(`mega-btn-${isMobile ? "xs" : "md"}`);

        if (!btn) return;

        btn.click()
    }

    return <Button
        variant="contained"
        color="secondary"
        {...props}
        onClick={handleClick}
    >
        همه محصولات
    </Button>
}