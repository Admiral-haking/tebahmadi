import { buildAdminMetadata } from '@/lib/admin-metadata';
import TapinProducts from './tapin-products';

export async function generateMetadata() {
  return buildAdminMetadata('محصولات تاپین');
}

export default function Page() {
  return <TapinProducts />;
}
