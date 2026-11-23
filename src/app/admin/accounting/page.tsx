import { Container } from '@mui/material';

import AccountingView from '@/views/admin/accounting';
import { buildAdminMetadata } from '@/lib/admin-metadata';

const PAGE_TITLE = 'حسابداری';

export async function generateMetadata() {
  return buildAdminMetadata(PAGE_TITLE);
}

export default function Page() {
  return (
    <Container maxWidth="xl" sx={{ py: 0 }}>
      <AccountingView />
    </Container>
  );
}
