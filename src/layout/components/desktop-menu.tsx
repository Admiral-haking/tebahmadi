import { Button, Stack } from '@mui/material';
import Link from 'next/link';

const links = [
  { href: '/blog', label: 'بلاگ' },
  { href: '/page/about', label: 'درباره ما' },
  { href: '/page/licenses', label: 'مجوزها' },
  { href: '/page/contact', label: 'تماس با ما' },
];

export default function DesktopMenu() {
  return (
    <Stack direction="row" alignItems="center" gap={0.25}>
      {links.map((item) => (
        <Button key={item.href} component={Link} href={item.href} color="inherit" sx={{ minHeight: 42, px: 1.5, fontWeight: 500 }}>
          {item.label}
        </Button>
      ))}
    </Stack>
  );
}
