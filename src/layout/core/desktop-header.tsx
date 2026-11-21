import Logo from "@/components/logo";
import { Box, Container, Stack } from "@mui/material";
import UserButton from "../components/user-button";
import ModeButton from "../components/mode-button";
import CartButton from "../components/cart-button";
import DesktopMenu from "../components/desktop-menu";
import { loadCategoryTree } from "@/lib/cache";
import MegaMenu from "../components/mega-menu";
import SearchBox from "@/components/search";
import { glassSurface } from "@/theme/design-system";

const divider = <Box
    sx={{
        m: 1,
        borderRight: `1px solid var(--mui-palette-divider)`,
        height: '100%'
    }}
/>

export default async function HeaderDesktop() {

    const categories = await loadCategoryTree();


    return <Box
        component="header"
        sx={{
            display: { xs: "none", md: "block" },
            position: "sticky",
            top: 0,
            zIndex: 1100,
            ...glassSurface,
            borderInline: 0,
            borderTop: 0,
        }}
    >
        <Container maxWidth="lg">
            <Stack
                direction="row"
                alignItems="center"
                gap={1.25}
                sx={{ minHeight: 82, width: '100%' }}
            >
                <Logo size={46} showName />
                {divider}
                <MegaMenu categories={JSON.parse(JSON.stringify(categories as any))} />
                <DesktopMenu />
                <Box flex="1 1 auto" />
                <SearchBox
                    onSearchUrl="/search"
                    alwaysShowSearch
                    boxSx={{ width: 300, maxWidth: 300 }}
                />
                <CartButton />
                <ModeButton />
                <UserButton />
            </Stack>
        </Container>
    </Box>
}

