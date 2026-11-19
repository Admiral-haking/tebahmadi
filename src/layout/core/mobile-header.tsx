import { Box, Stack, Typography } from "@mui/material";
import CartButton from "../components/cart-button";
import UserButton from "../components/user-button";
import ModeButton from "../components/mode-button";
import MegaMenuMobile from "../components/mega-menu-mobile";
import { loadCategoryTree } from "@/lib/cache";

export default async function HeaderMobile({ title }: { title: string }) {
    const categories = await loadCategoryTree();


    return <Stack
        component="header"
        direction="row"
        alignItems="center"
        sx={{
            display: { xs: 'flex', md: 'none' },
            bgcolor: 'background.paper',
            borderBottom: `1px solid var(--mui-palette-divider)`,
            p: 1,
            zIndex: 99,
            mx: 0
        }}
    >
        <MegaMenuMobile categories={JSON.parse(JSON.stringify(categories as any))} />
        <Box
            sx={{
                borderRight: `1px solid var(--mui-palette-divider)`,
                height: 35,
                mx: 1
            }}
        />
        <Typography fontWeight="bold" variant="subtitle1">
            {title}
        </Typography>
        <Box flex="1 1 auto" />
        <ModeButton />
        <CartButton />
        <UserButton />
    </Stack>
}