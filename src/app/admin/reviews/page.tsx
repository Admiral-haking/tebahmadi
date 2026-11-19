import { Container } from "@mui/material";
import ReviewsAdminView from "@/views/admin/reviews";
import { buildAdminMetadata } from "@/lib/admin-metadata";

export async function generateMetadata() {
    return buildAdminMetadata("مدیریت نظرات خریداران");
}

export default async function Page() {
    return (
        <Container maxWidth="lg" sx={{ py: 0 }}>
            <ReviewsAdminView />
        </Container>
    );
}
