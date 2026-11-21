import { Box, Stack, Typography } from "@mui/material";
import CartButton from "../components/cart-button";
import UserButton from "../components/user-button";
import MegaMenuMobile from "../components/mega-menu-mobile";
import { loadCategoryTree } from "@/lib/cache";
import SearchBox from "@/components/search";
import Logo from "@/components/logo";
import { glassSurface } from "@/theme/design-system";

export default async function HeaderMobile({ title }: { title: string }) {
    const categories = await loadCategoryTree();


    return <Stack
        component="header"
        sx={{
            display: { xs: 'flex', md: 'none' },
            position: "sticky",
            top: 0,
            zIndex: 1100,
            ...glassSurface,
            borderInline: 0,
            borderTop: 0,
            px: 1.5,
            py: 1,
        }}
    >
        <Stack direction="row" alignItems="center" sx={{ width: "100%" }}>
            <MegaMenuMobile categories={JSON.parse(JSON.stringify(categories as any))} />
            <Logo size={38} />
            <Typography fontWeight={700} variant="subtitle1" sx={{ mr: 1, minWidth: 0 }} noWrap>
                {title}
            </Typography>
            <Box flex="1 1 auto" />
            <CartButton />
            <UserButton />
        </Stack>
        <SearchBox
            onSearchUrl="/search"
            alwaysShowSearch
            boxSx={{ maxWidth: "none", mt: 0.75 }}
        />
    </Stack>
}
