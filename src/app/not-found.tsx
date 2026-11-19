import { Button, Container, Stack, Typography } from "@mui/material";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default function Page() {
    return <Container maxWidth="lg" sx={{ py: 6 }}>
        <Stack
            alignItems="center"
            justifyContent="center"
            sx={{ width: "100%" }}
            gap={2}
        >
            <Typography variant="h1">404</Typography>
            <Typography fontSize={38}>یافت نشد</Typography>
            <Typography fontSize={24}>
                متاسفانه صفحه ای که به دنبال ان میگردید یافت نشد
            </Typography>
            <Button LinkComponent={Link} href="/" variant="contained">
                برو به خانه
            </Button>
        </Stack>
    </Container>;
}
