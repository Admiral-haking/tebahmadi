"use client"

import Socials, { SocialLink } from "@/layout/components/socials";
import { useSiteInfo } from "@/views/admin/site-settings/hooks";
import {
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Typography,
} from "@mui/material";
import { useSearchParams } from "next/navigation"
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

export default function WelcomeLogic() {
    const params = useSearchParams();
    const { data } = useSiteInfo();

    const [social, setSocial] = useState(false);
    const [canCloseDialog, setCanCloseDialog] = useState(false);

    const openedAtRef = useRef(Date.now());
    const toastShownRef = useRef(false);

    const offer = params?.get("offer");

    const links = useMemo<SocialLink[]>(() => {
        const source = data?.socials ?? [];
        return source.filter((item) => item.url && item.platform);
    }, [data?.socials]);

    const showOfferToast = useCallback(() => {
        if (toastShownRef.current) return;

        const storedOffer = localStorage.getItem("offerX");
        if (!offer && !storedOffer) return;

        toastShownRef.current = true;
        toast.message("شما یک کد تخفیف برای استفاده دارید.", {
            duration: 20_000,
            action: {
                label: "برو به فروشگاه",
                onClick: () => {
                    window.location.href = "/store";
                },
            },
        });
    }, [offer, toastShownRef.current]);

    useEffect(() => {
        if (offer) {
            localStorage.setItem("offerX", offer);
        }

        const hasCoupon = Boolean(offer || localStorage.getItem("offerX"));
        if (!hasCoupon) return;

        const modalSeen = localStorage.getItem("socials-modal") === "1";


        if (offer && !modalSeen && links.length > 0) {
            openedAtRef.current = Date.now();
            setCanCloseDialog(false);
            setSocial(true);

            const timer = window.setTimeout(() => {
                setCanCloseDialog(true);
            }, 5_000);

            return () => window.clearTimeout(timer);
        } else if (offer)
            showOfferToast();
    }, [offer, links]);

    function handleSocialsClose() {
        if (!canCloseDialog) return;
        if (Date.now() - openedAtRef.current < 5_000) return;

        localStorage.setItem("socials-modal", "1");
        setSocial(false);
        showOfferToast();
    }

    return (
        <Dialog
            open={social}
            onClose={(_, reason) => {
                if (reason === "backdropClick" || reason === "escapeKeyDown") {
                    handleSocialsClose();
                    return;
                }
                handleSocialsClose();
            }}
            fullWidth
            maxWidth="xs"
            slotProps={{
                paper: {
                    sx: {
                        borderRadius: 4,
                        overflow: "hidden",
                        m: { xs: 2, sm: "auto" },
                        p: { xs: 1, sm: 1.5 },
                    },
                },
            }}
        >
            <DialogTitle sx={{ fontWeight: 800 }}>ما رو دنبال کن</DialogTitle>
            <DialogContent>
                <Typography sx={{ mb: 2 }} color="text.secondary">
                    در شبکه‌های مجازی ما رو دنبال کن، تا از خبر جدید عقب نمونی!
                </Typography>
                <Socials links={links.filter(x => x.platform !== 'torob' && x.platform !== 'digikala')} />
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
                <Button onClick={handleSocialsClose} disabled={!canCloseDialog} variant="contained" fullWidth sx={{ borderRadius: 99, py: 1.2 }}>
                    بستن
                </Button>
            </DialogActions>
        </Dialog>
    );
}
