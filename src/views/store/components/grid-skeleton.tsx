import { Grid, Skeleton } from "@mui/material";

const PAGE_SIZE = 24;
export default function StoreProductGridSkeleton() {
    return <Grid container spacing={2}>
        {new Array(PAGE_SIZE).fill(0).map((_, key) => (
            <Grid key={key} size={{ xs: 6, sm: 4, md: 3 }}>
                <Skeleton
                    variant="rectangular"
                    sx={{
                        width: "100%",
                        height: "100%",
                        minHeight: 321,
                    }}
                />
            </Grid>
        ))}
    </Grid>;
}