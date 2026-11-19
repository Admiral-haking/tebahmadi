import { Container } from '@mui/material';
import SlideAdminView from '@/views/admin/slide';
import { buildAdminMetadata } from '@/lib/admin-metadata';

const PAGE_TITLE = 'اسلایدها';

export async function generateMetadata() {
  return buildAdminMetadata(PAGE_TITLE);
}

export default function Page() {
  return (
    <Container maxWidth="lg" sx={{ py: 0 }}>
      <SlideAdminView />
    </Container>
  );
}

