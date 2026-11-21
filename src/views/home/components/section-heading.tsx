import { Box, Button, Stack, Typography } from '@mui/material';
import Link from 'next/link';

export default function SectionHeading({ title }: { title: string }) {
  return (
    <Stack alignItems="center" gap={0.5} sx={{ mb: { xs: 2.5, md: 3.5 } }}>
      <Box aria-hidden sx={{ width: 34, height: 18, position: 'relative', '&::before': { content: '""', position: 'absolute', inset: 0, background: 'repeating-conic-gradient(from 0deg, #b69a68 0deg 8deg, transparent 8deg 22deg)', mask: 'radial-gradient(circle, transparent 0 5px, #000 6px)' } }} />
      <Typography component="h2" sx={{ color: 'primary.main', fontSize: { xs: '1.45rem', md: '1.8rem' }, fontWeight: 800, textAlign: 'center' }}>
        {title}
      </Typography>
      <Button component={Link} href="/store" variant="text" size="small" sx={{ minHeight: 36 }}>
        مشاهده همه
      </Button>
    </Stack>
  );
}
