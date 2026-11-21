import React from "react";
import { Button, ButtonProps } from "@mui/material";
import Link from "next/link";


export default function MegaButton(props: ButtonProps) {
    return <Button
        component={Link}
        href="/store"
        variant="contained"
        color="primary"
        {...props}
    >
        همه محصولات
    </Button>
}
