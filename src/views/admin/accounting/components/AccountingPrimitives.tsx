import { Box, Card, CardContent, Stack, Typography } from '@mui/material';

export function KpiTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardContent>
        <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>{label}</Typography>
        <Typography sx={{ fontSize: 24, fontWeight: 800, mt: 0.5 }}>{value}</Typography>
        {hint ? (
          <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 0.5 }}>{hint}</Typography>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function BarRow({
  label,
  value,
  max,
  caption,
}: {
  label: string;
  value: number;
  max: number;
  caption: string;
}) {
  const pct = max > 0 ? Math.max((value / max) * 100, value > 0 ? 2 : 0) : 0;
  return (
    <Stack gap={0.5}>
      <Stack direction="row" justifyContent="space-between" gap={1}>
        <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{label}</Typography>
        <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>{caption}</Typography>
      </Stack>
      <Box sx={{ height: 10, borderRadius: 999, bgcolor: 'grey.100', overflow: 'hidden' }}>
        <Box sx={{ width: `${pct}%`, height: '100%', bgcolor: 'secondary.main' }} />
      </Box>
    </Stack>
  );
}
