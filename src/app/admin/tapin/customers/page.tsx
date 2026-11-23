import { buildAdminMetadata } from '@/lib/admin-metadata';
import TapinCustomers from './tapin-customers';
export async function generateMetadata() {
  return buildAdminMetadata('مشتریان تاپین');
}
export default function Page() {
  return <TapinCustomers />;
}
