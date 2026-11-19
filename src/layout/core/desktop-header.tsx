import Logo from "@/components/logo";
import { Box, Container, Stack } from "@mui/material";
import UserButton from "../components/user-button";
import ModeButton from "../components/mode-button";
import CartButton from "../components/cart-button";
import DesktopMenu from "../components/desktop-menu";
import { loadCategoryTree } from "@/lib/cache";
import MegaMenu from "../components/mega-menu";

const divider = <Box
    sx={{
        m: 1,
        borderRight: `1px solid var(--mui-palette-divider)`,
        height: '100%'
    }}
/>

export default async function HeaderDesktop() {

    const categories = await loadCategoryTree();


    return <Container
        maxWidth="lg"
        component="header"
        sx={{
            display: { xs: "none", md: "block" },
        }}
    >
        <Stack
            direction="row"
            alignItems="center"
            gap={1}
            sx={{
                p: 2,
                width: '100%'
            }}
        >
            <Logo />

            {divider}

            <MegaMenu categories={JSON.parse(JSON.stringify(categories as any))} />

            <DesktopMenu />

            {divider}

            <CartButton />

            <ModeButton />

            <UserButton />

        </Stack>
    </Container>
}

