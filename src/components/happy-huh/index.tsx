import { Box, Container, Stack, Typography } from "@mui/material";
import sigma from "./sigma.gif";
import Image from "next/image";


export default function HappyHuh() {
    return <Container maxWidth="lg">
        <Stack alignItems="center" justifyContent="center" gap={1} sx={{ my: 4, minHeight: 250 }}>
            <Box
                component={Image}
                src={sigma}
                alt="sigma ass"
                sx={{
                    borderRadius: 2
                }}
            />
            <Typography variant="h6">
                خوشحال رفتی یه صحنه ها؟
            </Typography>
            <Typography variant="body2">
                عجله نکن برار! اینجه هم درست مشه :)
            </Typography>
        </Stack>
    </Container>
}